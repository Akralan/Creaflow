import { eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { creatorProfiles, materialSources, postingGoals, products, startJobs, users } from "@/db/schema";
import {
  fetchBlobText,
  fetchPublicRepo,
  fetchTree,
  getPublicReadToken,
  GithubRateLimitError,
  GithubRepoNotFoundError,
  listCommits,
} from "@/lib/github/client";
import { buildCommitJournal, selectMarkdownFiles } from "@/lib/github/ingest";
import { parseRepoUrl } from "@/lib/github/repoUrl";
import { describeRepoCard, type RepoCard } from "@/lib/llm/repoCard";
import { llmFailureMessage } from "@/lib/llm/errors";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { publishingDaysSchema } from "@/lib/validation";
import { DEFAULT_PHASE, PHASES } from "@/lib/phases";

/**
 * Entrée par le repo (docs/SPEC_ENTREE_PAR_LE_REPO.md §4-§5) : lire un dépôt public sans compte,
 * en tirer la carte à trois champs, puis créer le compte quand l'email arrive.
 */

/** Mercredi, vendredi, samedi (ISO : 1 = lundi). */
export const START_DEFAULT_DAYS = [3, 5, 6];
/** Réseaux d'office de ce parcours ; la personne les change ensuite dans son profil. */
export const START_PLATFORMS = ["linkedin", "x"] as const;
/** Le post du mail et les deux suivants se génèrent sur ce réseau : trois jours, trois posts. */
export const START_POST_PLATFORM = "linkedin";

const README_CHARS = 3500;
const OTHER_DOC_CHARS = 1200;
const MAX_ANALYZED_DOCS = 4;
const JOURNAL_CHARS = 3000;
const ANALYZED_COMMITS = 30;

export interface StartRepo {
  externalId: string;
  fullName: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
}

export interface StartAnalysis {
  repo: StartRepo;
  card: RepoCard;
  /** Faux quand le modèle n'a pas répondu : les champs restent à remplir à la main. */
  extracted: boolean;
  failureReason: string | null;
}

/** Une lecture qui échoue autrement que par un dépôt introuvable est traitée comme « rien à lire ». */
async function tolerate<T>(fallback: T, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof GithubRateLimitError) throw error;
    return fallback;
  }
}

async function loadPublicRepo(fullName: string): Promise<StartRepo> {
  const token = getPublicReadToken();
  try {
    const repo = await fetchPublicRepo(token, fullName);
    if (repo.private) throw new GithubRepoNotFoundError(fullName);
    return {
      externalId: repo.externalId,
      fullName: repo.fullName,
      name: repo.name,
      description: repo.description,
      defaultBranch: repo.defaultBranch,
      language: repo.language,
    };
  } catch (error) {
    if (error instanceof GithubRepoNotFoundError) {
      throw new ApiError(404, "We can't read this repo. Is it public?");
    }
    if (error instanceof GithubRateLimitError) {
      throw new ApiError(503, "GitHub is busy right now. Try again in a few minutes.");
    }
    throw error;
  }
}

export async function analyzeRepo(rawUrl: string): Promise<StartAnalysis> {
  const parsed = parseRepoUrl(rawUrl);
  if (!parsed) throw new ApiError(400, "Paste the link of a public GitHub repository, like github.com/you/your-saas.");
  const repo = await loadPublicRepo(parsed.fullName);
  const token = getPublicReadToken();

  let sections: string[];
  try {
    const { entries } = await tolerate({ entries: [], truncated: false }, () => fetchTree(token, repo.fullName, repo.defaultBranch));
    const files = selectMarkdownFiles(entries).slice(0, MAX_ANALYZED_DOCS);
    const docs: string[] = [];
    for (const [i, file] of files.entries()) {
      const text = await tolerate("", () => fetchBlobText(token, repo.fullName, file.sha));
      if (text.trim()) docs.push(`# ${file.path}\n${text.slice(0, i === 0 ? README_CHARS : OTHER_DOC_CHARS)}`);
    }
    const commits = await tolerate([], () => listCommits(token, repo.fullName, repo.defaultBranch, ANALYZED_COMMITS));
    const journal = buildCommitJournal(commits).slice(0, JOURNAL_CHARS);
    sections = [...docs, ...(journal ? [`# Recent commits\n${journal}`] : [])];
  } catch (error) {
    if (error instanceof GithubRateLimitError) throw new ApiError(503, "GitHub is busy right now. Try again in a few minutes.");
    throw error;
  }

  if (sections.length === 0) {
    throw new ApiError(422, "This repo has nothing we can read yet: no README, no docs, no commit messages.");
  }

  try {
    const card = await describeRepoCard({
      fullName: repo.fullName,
      repoDescription: repo.description,
      language: repo.language,
      excerpt: sections.join("\n\n"),
    });
    return { repo, card: { ...card, name: card.name || repo.name, tagline: card.tagline || repo.description || "" }, extracted: true, failureReason: null };
  } catch (error) {
    logger.warn("Repo card extraction failed", { error: error instanceof Error ? error.message : String(error) });
    return {
      repo,
      card: { name: repo.name, tagline: repo.description ?? "", building: "", who: "", problem: "", phase: DEFAULT_PHASE, phaseReason: "" },
      extracted: false,
      failureReason: llmFailureMessage(error),
    };
  }
}

export const startSchema = z.object({
  repo: z.string().min(1),
  name: z.string().trim().max(120).optional(),
  building: z.string().trim().min(1, "Say in one sentence what you're building.").max(600),
  who: z.string().trim().max(600).optional(),
  problem: z.string().trim().max(600).optional(),
  // Pourquoi cette personne se met à publier. Aucun modèle ne peut le deviner depuis un dépôt, et
  // c'est le sujet du post d'origine : sans lui, l'origine recopie la fiche produit.
  why: z.string().trim().max(600).optional(),
  days: publishingDaysSchema.default(START_DEFAULT_DAYS),
  // Devinée par la carte, corrigée par la personne (src/lib/phases.ts).
  phase: z.enum(PHASES).default(DEFAULT_PHASE),
  email: z.email(),
});
export type StartInput = z.infer<typeof startSchema>;

function dailyCap(): number {
  const raw = Number(process.env.START_DAILY_CAP);
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

/** Plafond global de nouveaux comptes par jour : le coût d'une génération est le nôtre. */
async function enforceDailyCap(): Promise<void> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(startJobs).where(gte(startJobs.createdAt, dayStart));
  if (count >= dailyCap()) {
    throw new ApiError(503, "We're at capacity today. Come back tomorrow — your repo will still be here.");
  }
}

export interface StartResult {
  userId: string;
  /** Faux quand l'adresse avait déjà un compte : on lui envoie seulement un lien de connexion. */
  created: boolean;
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code ?? (error as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505";
}

/**
 * Crée le compte (sans mot de passe, sans session), le profil, le sujet unique et sa source GitHub
 * publique, les réseaux et les jours. Ne génère rien : l'appelant lance `runStartJob` après la réponse.
 */
export async function createStartAccount(input: StartInput): Promise<StartResult> {
  const parsed = parseRepoUrl(input.repo);
  if (!parsed) throw new ApiError(400, "Paste the link of a public GitHub repository.");
  const email = input.email.toLowerCase();

  // Mêmes contrôles, dans le même ordre, que l'adresse ait déjà un compte ou non : la réponse ne doit pas
  // révéler qui est inscrit (plafond du jour et dépôt illisible compris). Le dépôt est relu juste avant
  // d'écrire : la source a besoin de son identifiant et de sa branche, et un dépôt passé en privé entre-temps
  // ne doit pas laisser un compte à moitié fait.
  await enforceDailyCap();
  const repo = await loadPublicRepo(parsed.fullName);

  const existing = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (existing) return { userId: existing.id, created: false };
  const productName = input.name?.trim() || repo.name;

  try {
    const userId = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email, passwordHash: null, vertical: "dev" }).returning({ id: users.id });
      await tx.insert(creatorProfiles).values({
        userId: user.id,
        brandName: parsed.owner,
        activityType: input.building,
        targetAudience: input.who || null,
        expectations: input.why || null,
        publishingDays: input.days,
      });
      const [product] = await tx
        .insert(products)
        .values({ userId: user.id, name: productName, description: input.building, targetAudience: input.who || null, problem: input.problem || null, phase: input.phase })
        .returning({ id: products.id });
      await tx.insert(materialSources).values({
        userId: user.id,
        productId: product.id,
        type: "github_repo",
        externalId: repo.externalId,
        label: repo.fullName,
        config: { defaultBranch: repo.defaultBranch, public: true },
      });
      for (const platform of START_PLATFORMS) {
        await tx.insert(postingGoals).values({ userId: user.id, platform, targetCountPerWeek: input.days.length });
      }
      await tx.insert(startJobs).values({ userId: user.id });
      return user.id;
    });
    return { userId, created: true };
  } catch (error) {
    // Deux envois simultanés avec la même adresse : le second retombe sur le compte du premier.
    if (isUniqueViolation(error)) {
      const winner = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
      if (winner) return { userId: winner.id, created: false };
    }
    throw error;
  }
}

export async function getStartJob(userId: string) {
  return db.query.startJobs.findFirst({ where: eq(startJobs.userId, userId) });
}

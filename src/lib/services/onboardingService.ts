import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { creatorProfiles, materialSources, oauthAccounts, postingGoals, products, sourceMaterials } from "@/db/schema";
import { extractProfileFromMaterial, normalizeSubjects, type ExtractedProfile } from "@/lib/llm/profileExtraction";
import { generateCategoriesForUser, listActiveCategoriesForUser } from "@/lib/services/categoryLabelsService";
import { generateAnglesForUser, listActiveAnglesForUser } from "@/lib/services/angleService";
import { generateSeriesForUser, listActiveSeriesForUser } from "@/lib/services/seriesService";
import { createPastedMaterial } from "@/lib/services/sourceMaterialService";
import { listConnectedProviders } from "@/lib/services/oauthAccountService";
import { identityProviderLabel } from "@/lib/oauth/registry";
import { expectationsSchema, MAX_PRODUCTS, platformSchema, publishingDaysSchema } from "@/lib/validation";
import { ApiError } from "@/lib/api/errors";
import { llmFailureMessage } from "@/lib/llm/errors";
import { logger } from "@/lib/logger";

/**
 * Onboarding MVP (docs/SPEC_ONBOARDING_MVP.md) : brancher sa matière, corriger ce qu'on en a
 * compris, dire ce qu'on attend, choisir ses jours. Plus de chat : le profil se déduit de la
 * matière en un appel (`profileExtraction.ts`), et tout s'écrit en une fois à la fin.
 */

/** Type de source → fournisseur, pour afficher « GitHub · akralan/creaflow » sans table en dur
 *  côté écran. */
const PROVIDER_BY_SOURCE_TYPE: Record<string, string> = {
  github_repo: "github",
  notion_page: "notion",
  linear_project: "linear",
};

const NOTES_TITLE = "Mes notes";
const MAX_ONBOARDING_NOTES = 10;
/** Extrait par source envoyé au modèle : assez pour comprendre le projet, pas pour le résumer. */
const EXCERPT_CHARS_PER_DOC = 700;
const DOCS_PER_SOURCE = 3;

export interface OnboardingSource {
  id: string;
  provider: string;
  providerLabel: string;
  label: string;
  productId: string;
}

export interface OnboardingNote {
  id: string;
  excerpt: string;
}

/**
 * L'onboarding est terminé quand le profil existe ET que la génération qui suit (rôles, séries) a
 * abouti : le profil s'écrit avant les appels LLM, et un échec entre les deux ne doit pas laisser
 * la personne sur un calendrier sans rôles. Tant que ce n'est pas vrai, on la renvoie à
 * l'onboarding, dont la fin est rejouable.
 */
export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { id: true } });
  if (!profile) return false;
  const [categories, series] = await Promise.all([listActiveCategoriesForUser(userId), listActiveSeriesForUser(userId)]);
  return categories.length > 0 && series.length > 0;
}

export async function getOnboardingState(userId: string) {
  const [completed, connectedProviders, accounts, sourceRows, noteRows] = await Promise.all([
    isOnboardingComplete(userId),
    listConnectedProviders(userId),
    db.query.oauthAccounts.findMany({ where: eq(oauthAccounts.userId, userId), columns: { name: true, login: true } }),
    db.query.materialSources.findMany({ where: eq(materialSources.userId, userId) }),
    db.query.sourceMaterials.findMany({
      where: and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.kind, "paste")),
      columns: { id: true, rawText: true },
      orderBy: desc(sourceMaterials.createdAt),
    }),
  ]);

  const sources: OnboardingSource[] = sourceRows.map((row) => {
    const provider = PROVIDER_BY_SOURCE_TYPE[row.type] ?? row.type;
    return { id: row.id, provider, providerLabel: identityProviderLabel(provider), label: row.label, productId: row.productId };
  });
  const notes: OnboardingNote[] = noteRows.map((row) => ({ id: row.id, excerpt: row.rawText.slice(0, 160) }));

  return {
    hasProfile: completed,
    connectedProviders,
    // Repli quand le nom saisi à l'écran 1 s'est perdu (autre navigateur au retour d'OAuth).
    suggestedName: accounts.find((a) => a.name)?.name ?? accounts[0]?.login ?? "",
    sources,
    notes,
  };
}

/** « Coller mes notes » : matière collée de niveau marque, rattachée à un sujet à la fin. */
export async function addOnboardingNotes(userId: string, rawText: string) {
  const existing = await db.query.sourceMaterials.findMany({
    where: and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.kind, "paste")),
    columns: { id: true },
  });
  if (existing.length >= MAX_ONBOARDING_NOTES) {
    throw new ApiError(400, `Au plus ${MAX_ONBOARDING_NOTES} blocs de notes : regroupe-les en un seul.`);
  }
  const row = await createPastedMaterial(userId, { title: NOTES_TITLE, rawText });
  return { id: row.id, excerpt: row.rawText.slice(0, 160) };
}

async function excerptForSource(sourceId: string): Promise<string> {
  const docs = await db.query.sourceMaterials.findMany({
    where: eq(sourceMaterials.sourceId, sourceId),
    columns: { title: true, rawText: true },
    orderBy: desc(sourceMaterials.createdAt),
    limit: 20,
  });
  // Le README d'abord quand il existe : c'est la page où un projet dit ce qu'il est.
  const ordered = [...docs].sort((a, b) => Number(/readme/i.test(b.title ?? "")) - Number(/readme/i.test(a.title ?? "")));
  return ordered
    .slice(0, DOCS_PER_SOURCE)
    .map((doc) => `${doc.title ? `# ${doc.title}\n` : ""}${doc.rawText.slice(0, EXCERPT_CHARS_PER_DOC)}`)
    .join("\n\n");
}

export interface OnboardingDraft extends ExtractedProfile {
  /** Faux quand le modèle n'a pas répondu : l'écran affiche la raison et relance, ou laisse
   *  remplir à la main à partir des sujets de repli (une source = un sujet). */
  extracted: boolean;
  /** Raison lisible de l'échec, null quand l'extraction a réussi. */
  failureReason: string | null;
}


/** Écran 3 : lit la matière branchée et propose profil + sujets regroupés. N'écrit rien. */
export async function draftOnboardingProfile(userId: string, name: string): Promise<OnboardingDraft> {
  const state = await getOnboardingState(userId);
  const accounts = await db.query.oauthAccounts.findMany({ where: eq(oauthAccounts.userId, userId) });
  const items = [
    ...(await Promise.all(
      state.sources.map(async (source) => ({
        key: `source:${source.id}`,
        kind: source.providerLabel,
        label: source.label,
        excerpt: await excerptForSource(source.id),
      }))
    )),
    ...(await Promise.all(
      state.notes.map(async (note) => {
        const row = await db.query.sourceMaterials.findFirst({ where: eq(sourceMaterials.id, note.id), columns: { rawText: true } });
        return { key: `note:${note.id}`, kind: "Notes collées", label: NOTES_TITLE, excerpt: (row?.rawText ?? "").slice(0, 2000) };
      })
    )),
  ];
  if (items.length === 0) {
    throw new ApiError(400, "Branche au moins une source ou colle tes notes avant de continuer.");
  }

  try {
    const extracted = await extractProfileFromMaterial({
      name,
      identities: accounts.map((a) => ({ provider: identityProviderLabel(a.provider), login: a.login, name: a.name, bio: a.bio })),
      items,
    });
    return { ...extracted, extracted: true, failureReason: null };
  } catch (error) {
    // Jamais bloquant : l'écran affiche la raison et relance ; à défaut, la personne remplit
    // elle-même à partir de ces sujets de repli, chaque source devenant le sien (spec §4).
    logger.warn("Extraction du profil d'onboarding impossible", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      activityType: "",
      targetAudience: "",
      subjects: normalizeSubjects([], items),
      extracted: false,
      failureReason: llmFailureMessage(error),
    };
  }
}

export const completeOnboardingSchema = z.object({
  name: z.string().trim().min(1, "Dis-nous comment tu t'appelles."),
  activityType: z.string().trim().min(1, "Décris en une phrase ce que tu fais."),
  targetAudience: z.string().trim().max(1000).optional(),
  expectations: expectationsSchema.optional(),
  publishingDays: publishingDaysSchema,
  platforms: z.array(platformSchema).min(1, "Choisis au moins un réseau où publier."),
  subjects: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Chaque sujet a besoin d'un nom."),
        description: z.string().trim().max(500).optional(),
        keys: z.array(z.string()).min(1),
      })
    )
    .min(1, "Il faut au moins un sujet.")
    .max(MAX_PRODUCTS, `Au plus ${MAX_PRODUCTS} sujets : regroupe ceux qui parlent du même projet.`),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

/**
 * Plan de regroupement, en pur : quel sujet existant réutiliser pour chaque groupe (celui de sa
 * première source, renommé), et quels sujets deviennent vides une fois les sources déplacées.
 * Extrait pour être testé sans base — c'est là que se décide qu'aucune matière ne se perd.
 */
export function planSubjectGrouping(
  groups: Array<{ keys: string[] }>,
  sources: Array<{ id: string; productId: string }>,
  noteIds: string[]
) {
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const knownNotes = new Set(noteIds);
  const seen = new Set<string>();
  const usedTargets = new Set<string>();

  const plan = groups.map((group) => {
    const sourceIds: string[] = [];
    const notes: string[] = [];
    for (const key of group.keys) {
      if (seen.has(key)) throw new ApiError(400, "Une source apparaît dans deux sujets.");
      seen.add(key);
      const [kind, id] = key.split(":");
      if (kind === "source" && sourceById.has(id)) sourceIds.push(id);
      else if (kind === "note" && knownNotes.has(id)) notes.push(id);
      else throw new ApiError(400, "Source inconnue dans un sujet.");
    }
    // Réutilise le sujet d'une des sources du groupe, une seule fois par sujet : deux groupes ne
    // peuvent pas viser le même.
    const target = sourceIds.map((id) => sourceById.get(id)!.productId).find((pid) => !usedTargets.has(pid)) ?? null;
    if (target) usedTargets.add(target);
    return { sourceIds, noteIds: notes, targetProductId: target };
  });

  // Une source oubliée resterait sur son ancien sujet, peut-être renommé pour un autre groupe :
  // fusion silencieuse. Tout doit être rangé quelque part.
  if (seen.size !== sources.length + noteIds.length) {
    throw new ApiError(400, "Chaque source et chaque note doit appartenir à un sujet.");
  }

  const orphanedProductIds = [...new Set(sources.map((s) => s.productId))].filter((pid) => !usedTargets.has(pid));
  return { plan, orphanedProductIds };
}

/** Fin de l'onboarding : regroupe les sources en sujets, écrit le profil et le rythme, puis génère
 *  rôles, angles et séries. Rejouable sans dégât si la génération échoue en route. */
export async function completeOnboarding(userId: string, input: CompleteOnboardingInput) {
  const state = await getOnboardingState(userId);
  const { plan, orphanedProductIds } = planSubjectGrouping(
    input.subjects,
    state.sources,
    state.notes.map((n) => n.id)
  );

  await db.transaction(async (tx) => {
    for (const [i, group] of plan.entries()) {
      const subject = input.subjects[i];
      const values = { name: subject.name, description: subject.description || null };
      let productId = group.targetProductId;
      if (productId) {
        await tx.update(products).set(values).where(and(eq(products.id, productId), eq(products.userId, userId)));
      } else {
        [{ id: productId }] = await tx.insert(products).values({ userId, ...values }).returning({ id: products.id });
      }
      if (group.sourceIds.length > 0) {
        await tx
          .update(materialSources)
          .set({ productId })
          .where(and(eq(materialSources.userId, userId), inArray(materialSources.id, group.sourceIds)));
        // Les documents miroirs portent aussi le sujet : sans ça, la génération du nouveau sujet ne
        // verrait pas la matière des sources qu'on vient d'y ranger.
        await tx
          .update(sourceMaterials)
          .set({ productId })
          .where(and(eq(sourceMaterials.userId, userId), inArray(sourceMaterials.sourceId, group.sourceIds)));
      }
      if (group.noteIds.length > 0) {
        await tx
          .update(sourceMaterials)
          .set({ productId })
          .where(and(eq(sourceMaterials.userId, userId), inArray(sourceMaterials.id, group.noteIds)));
      }
    }
    // Les sujets créés par branchement et vidés par le regroupement n'ont plus rien à dire.
    for (const productId of orphanedProductIds) {
      const stillUsed = await tx.query.materialSources.findFirst({
        where: eq(materialSources.productId, productId),
        columns: { id: true },
      });
      if (!stillUsed) await tx.delete(products).where(and(eq(products.id, productId), eq(products.userId, userId)));
    }

    const profileValues = {
      brandName: input.name,
      activityType: input.activityType,
      targetAudience: input.targetAudience || null,
      expectations: input.expectations || null,
      publishingDays: input.publishingDays,
    };
    const existing = await tx.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
    if (existing) await tx.update(creatorProfiles).set(profileValues).where(eq(creatorProfiles.userId, userId));
    else await tx.insert(creatorProfiles).values({ userId, ...profileValues });

    // Une plateforme choisie = active, au rythme des jours cochés (spec §3) ; les autres coupées.
    const goals = await tx.query.postingGoals.findMany({ where: eq(postingGoals.userId, userId) });
    for (const platform of new Set([...input.platforms, ...goals.map((g) => g.platform)])) {
      const targetCountPerWeek = input.platforms.includes(platform) ? input.publishingDays.length : 0;
      const goal = goals.find((g) => g.platform === platform);
      if (goal) await tx.update(postingGoals).set({ targetCountPerWeek }).where(eq(postingGoals.id, goal.id));
      else await tx.insert(postingGoals).values({ userId, platform, targetCountPerWeek });
    }
  });

  try {
    if ((await listActiveCategoriesForUser(userId)).length === 0) await generateCategoriesForUser(userId);
    if ((await listActiveAnglesForUser(userId)).length === 0) await generateAnglesForUser(userId);
  // Dépend des rôles générés juste au-dessus.
    if ((await listActiveSeriesForUser(userId)).length === 0) await generateSeriesForUser(userId);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error("Génération de fin d'onboarding échouée (profil enregistré)", error);
    // Le profil et les sujets sont écrits : relancer ne refait que ce qui manque.
    throw new ApiError(503, `${llmFailureMessage(error)} Tes réponses sont enregistrées, réessaie dans un instant.`);
  }
}

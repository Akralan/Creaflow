import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { githubAccounts, materialSources, products, sourceMaterials } from "@/db/schema";
import { fetchBlobText, fetchTree, listCommits, GithubAuthError, type GithubRepo } from "@/lib/github/client";
import { buildCommitJournal, COMMITS_EXTERNAL_REF, selectMarkdownFiles } from "@/lib/github/ingest";
import type { DevOnboardingContext } from "@/lib/llm/onboardingChat";
import { markStaleForMaterialIngestion } from "@/lib/services/narrativeDirector";
import { ApiError } from "@/lib/api/errors";
import { MAX_PRODUCTS } from "@/lib/validation";
import { logger } from "@/lib/logger";

export interface ExistingDoc {
  id: string;
  externalRef: string;
  externalChecksum: string | null;
}

export interface IncomingDoc {
  externalRef: string;
  externalChecksum: string;
  title: string;
  rawText: string;
}

export interface DocumentDiff {
  toInsert: IncomingDoc[];
  toUpdate: Array<{ id: string; doc: IncomingDoc }>;
  unchanged: number;
}

/**
 * Décision d'écriture, extraite de l'accès base pour être testable sans PostgreSQL.
 *
 * Un chemin présent en base mais absent du dépôt n'apparaît dans aucune des trois catégories : il
 * est laissé intact. C'est de la matière passée toujours valable, et ses sourceMaterialCitations
 * pointent dessus.
 */
export function diffDocuments(existing: ExistingDoc[], incoming: IncomingDoc[]): DocumentDiff {
  const byRef = new Map(existing.map((doc) => [doc.externalRef, doc]));
  const diff: DocumentDiff = { toInsert: [], toUpdate: [], unchanged: 0 };

  for (const doc of incoming) {
    const match = byRef.get(doc.externalRef);
    if (!match) {
      diff.toInsert.push(doc);
    } else if (match.externalChecksum === doc.externalChecksum) {
      diff.unchanged += 1;
    } else {
      diff.toUpdate.push({ id: match.id, doc });
    }
  }

  return diff;
}

export interface SyncReport {
  added: number;
  updated: number;
  unchanged: number;
  truncated: boolean;
}

async function getAccessToken(userId: string): Promise<string> {
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  if (!account) {
    throw new ApiError(400, "Aucun compte GitHub connecté.");
  }
  return account.accessToken;
}

/** Construit la liste des documents que le dépôt devrait produire, sans rien écrire. */
async function collectIncomingDocs(
  token: string,
  fullName: string,
  branch: string
): Promise<{ docs: IncomingDoc[]; truncated: boolean; headSha: string | null }> {
  const { entries, truncated } = await fetchTree(token, fullName, branch);
  const selected = selectMarkdownFiles(entries);

  const docs: IncomingDoc[] = [];
  for (const entry of selected) {
    // Séquentiel plutôt qu'un Promise.all : 50 blobs en parallèle sur le quota GitHub d'un
    // utilisateur qui peut avoir plusieurs dépôts en cours d'ingestion, pour aucun gain perceptible.
    const rawText = await fetchBlobText(token, fullName, entry.sha);
    if (!rawText.trim()) continue; // un .md vide n'est pas de la matière
    docs.push({ externalRef: entry.path, externalChecksum: entry.sha, title: entry.path, rawText });
  }

  const commits = await listCommits(token, fullName, branch);
  const journal = buildCommitJournal(commits);
  const headSha = commits[0]?.sha ?? null;
  if (journal && headSha) {
    docs.push({
      externalRef: COMMITS_EXTERNAL_REF,
      externalChecksum: headSha,
      title: `Journal de commits — ${fullName}`,
      rawText: journal,
    });
  }

  return { docs, truncated, headSha };
}

export async function syncSource(userId: string, sourceId: string): Promise<SyncReport> {
  const source = await db.query.materialSources.findFirst({
    where: and(eq(materialSources.id, sourceId), eq(materialSources.userId, userId)),
  });
  if (!source) {
    throw new ApiError(404, "Source introuvable.");
  }

  const token = await getAccessToken(userId);
  const branch = (source.config as { defaultBranch?: string }).defaultBranch ?? "main";

  let collected;
  try {
    collected = await collectIncomingDocs(token, source.label, branch);
  } catch (error) {
    // Dépôt passé en privé, supprimé, ou token révoqué : la source devient inutilisable, mais les
    // documents déjà ingérés restent (spec §10).
    const isAuth = error instanceof GithubAuthError;
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await db
      .update(materialSources)
      .set({ status: isAuth ? "needs_reconnect" : "error", lastError: message })
      .where(eq(materialSources.id, sourceId));
    throw error;
  }

  // Dépôt vide, ou sans aucun .md ni commit exploitable : rien à ingérer. Le sujet est conservé —
  // l'utilisateur l'a choisi délibérément — mais la source dit clairement qu'elle ne donne rien,
  // plutôt que d'afficher une synchronisation réussie sur un corpus resté vide (spec §10).
  if (collected.docs.length === 0) {
    await db
      .update(materialSources)
      .set({
        status: "error",
        lastError: "Ce dépôt ne contient ni fichier .md ni commit exploitable.",
        lastSyncedAt: new Date(),
      })
      .where(eq(materialSources.id, sourceId));
    return { added: 0, updated: 0, unchanged: 0, truncated: collected.truncated };
  }

  const existing = await db.query.sourceMaterials.findMany({
    where: and(eq(sourceMaterials.sourceId, sourceId), isNotNull(sourceMaterials.externalRef)),
    columns: { id: true, externalRef: true, externalChecksum: true },
  });

  const diff = diffDocuments(
    existing.map((doc) => ({ id: doc.id, externalRef: doc.externalRef!, externalChecksum: doc.externalChecksum })),
    collected.docs
  );

  if (diff.toInsert.length > 0) {
    await db.insert(sourceMaterials).values(
      diff.toInsert.map((doc) => ({
        userId,
        productId: source.productId,
        sourceId,
        kind: "connector" as const,
        title: doc.title,
        rawText: doc.rawText,
        externalRef: doc.externalRef,
        externalChecksum: doc.externalChecksum,
      }))
    );
  }

  for (const { id, doc } of diff.toUpdate) {
    await db
      .update(sourceMaterials)
      // summary remis à null : pour une source connectée, c'est le dépôt qui fait foi, pas une
      // édition locale — rupture volontaire avec la règle « l'édition manuelle devient la source de
      // vérité » d'updateMaterialSummary. Le backfill paresseux le regénérera.
      .set({ rawText: doc.rawText, externalChecksum: doc.externalChecksum, title: doc.title, summary: null })
      .where(eq(sourceMaterials.id, id));
  }

  await db
    .update(materialSources)
    .set({
      lastSyncedAt: new Date(),
      syncCursor: collected.headSha,
      status: "ok",
      // Une ingestion partielle (arbre tronqué sur un dépôt volumineux) est signalée sans passer la
      // source en "error" : ce n'est pas un échec.
      lastError: collected.truncated
        ? "Dépôt volumineux : l'arbre GitHub a été tronqué, ingestion partielle."
        : null,
    })
    .where(eq(materialSources.id, sourceId));

  if (diff.toInsert.length > 0 || diff.toUpdate.length > 0) {
    // Sans ça le rédacteur en chef ne replanifierait pas après une synchro, alors qu'il le fait sur
    // un dépôt manuel (POST /api/materials).
    await markStaleForMaterialIngestion(userId, source.productId);
  }

  return {
    added: diff.toInsert.length,
    updated: diff.toUpdate.length,
    unchanged: diff.unchanged,
    truncated: collected.truncated,
  };
}

export interface CreatedSourceResult {
  productId: string;
  sourceId: string;
  label: string;
  report: SyncReport | null;
  error: string | null;
}

/** Crée un sujet et une source par dépôt, puis ingère. Un dépôt qui échoue n'empêche pas les
 *  autres : le sujet reste, la source porte l'erreur, et l'utilisateur peut resynchroniser plus tard. */
export async function createGithubSources(userId: string, repos: GithubRepo[]): Promise<CreatedSourceResult[]> {
  const existing = await db.query.products.findMany({ where: eq(products.userId, userId), columns: { id: true } });
  if (existing.length + repos.length > MAX_PRODUCTS) {
    throw new ApiError(400, `Maximum ${MAX_PRODUCTS} sujets (${existing.length} déjà enregistrés).`);
  }

  const results: CreatedSourceResult[] = [];

  for (const repo of repos) {
    const [product] = await db
      .insert(products)
      .values({ userId, name: repo.name, description: repo.description ?? null })
      .returning({ id: products.id });

    const [source] = await db
      .insert(materialSources)
      .values({
        userId,
        productId: product.id,
        type: "github_repo",
        externalId: repo.externalId,
        label: repo.fullName,
        config: { defaultBranch: repo.defaultBranch },
      })
      .returning({ id: materialSources.id });

    try {
      const report = await syncSource(userId, source.id);
      results.push({ productId: product.id, sourceId: source.id, label: repo.fullName, report, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      logger.error("Ingestion GitHub échouée (sujet et source conservés)", error, { fullName: repo.fullName });
      results.push({ productId: product.id, sourceId: source.id, label: repo.fullName, report: null, error: message });
    }
  }

  return results;
}

/** Contexte injecté au chat d'onboarding dev : profil GitHub et sujets retenus, avec le début de
 *  leur README déjà ingéré. Le README est retrouvé par son externalRef, pas par une relecture
 *  GitHub — la matière est déjà là, inutile de repayer un appel réseau. */
export async function buildDevOnboardingContext(userId: string): Promise<DevOnboardingContext> {
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  const sources = await db.query.materialSources.findMany({ where: eq(materialSources.userId, userId) });
  const productRows = await db.query.products.findMany({ where: eq(products.userId, userId) });

  const subjects: DevOnboardingContext["subjects"] = [];
  for (const product of productRows) {
    const source = sources.find((s) => s.productId === product.id);
    const readme = source
      ? await db.query.sourceMaterials.findFirst({
          where: and(eq(sourceMaterials.sourceId, source.id), eq(sourceMaterials.externalRef, "README.md")),
          columns: { rawText: true },
        })
      : null;
    subjects.push({
      name: product.name,
      description: product.description,
      // Le langage principal n'est pas persisté : il vient de l'API GitHub à la sélection et n'a pas
      // de colonne. Le nom et la description du dépôt portent déjà l'essentiel.
      language: null,
      readmeExcerpt: readme ? readme.rawText.slice(0, 600) : null,
    });
  }

  return {
    login: account?.login ?? "",
    name: account?.name ?? null,
    bio: account?.bio ?? null,
    subjects,
  };
}

export async function listSourcesForProduct(userId: string, productId: string) {
  return db.query.materialSources.findMany({
    where: and(eq(materialSources.userId, userId), eq(materialSources.productId, productId)),
  });
}

/** Supprime la source ET ses documents miroir (cascade sur sourceMaterials.sourceId, spec §3.3). */
export async function deleteSource(userId: string, sourceId: string) {
  const [deleted] = await db
    .delete(materialSources)
    .where(and(eq(materialSources.id, sourceId), eq(materialSources.userId, userId)))
    .returning({ id: materialSources.id });
  if (!deleted) {
    throw new ApiError(404, "Source introuvable.");
  }
  return deleted;
}

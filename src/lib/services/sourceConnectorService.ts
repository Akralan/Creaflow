import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, materialSources, products, sourceMaterials } from "@/db/schema";
import { getConnector } from "@/lib/connectors/registry";
import type { ConnectorCandidate, IncomingDoc, MaterialSourceType } from "@/lib/connectors/types";
import { scheduleEventReading } from "@/lib/services/materialEventService";
import { ApiError } from "@/lib/api/errors";
import { MAX_ONBOARDING_SOURCES, MAX_PRODUCTS } from "@/lib/validation";
import { logger } from "@/lib/logger";

/**
 * Synchronisation des sources de matière connectées, tous fournisseurs confondus. Rien ici ne sait
 * ce qu'est GitHub : le connecteur est résolu depuis `source.type`
 * (docs/ARCHITECTURE_VERTICALES.md §4, chantier 1).
 */

export interface ExistingDoc {
  id: string;
  externalRef: string;
  externalChecksum: string | null;
}

export type { IncomingDoc };

export interface DocumentDiff {
  toInsert: IncomingDoc[];
  toUpdate: Array<{ id: string; doc: IncomingDoc }>;
  unchanged: number;
}

/**
 * Décision d'écriture, extraite de l'accès base pour être testable sans PostgreSQL.
 *
 * Un `externalRef` présent en base mais absent de la source n'apparaît dans aucune des trois
 * catégories : il est laissé intact. C'est de la matière passée toujours valable, et ses
 * sourceMaterialCitations pointent dessus.
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

export async function syncSource(userId: string, sourceId: string): Promise<SyncReport> {
  const source = await db.query.materialSources.findFirst({
    where: and(eq(materialSources.id, sourceId), eq(materialSources.userId, userId)),
  });
  if (!source) {
    throw new ApiError(404, "Source not found.");
  }

  const connector = getConnector(source.type);

  let collected;
  try {
    collected = await connector.fetchDocuments(userId, source);
  } catch (error) {
    // Source devenue inaccessible (dépôt passé en privé, supprimé, ou accès révoqué) : elle devient
    // inutilisable, mais les documents déjà ingérés restent.
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(materialSources)
      .set({ status: connector.isAuthError(error) ? "needs_reconnect" : "error", lastError: message })
      .where(eq(materialSources.id, sourceId));
    throw error;
  }

  // Source vide : rien à ingérer. Le sujet est conservé — l'utilisateur l'a choisi délibérément —
  // mais la source dit clairement qu'elle ne donne rien, plutôt que d'afficher une synchronisation
  // réussie sur un corpus resté vide.
  if (collected.docs.length === 0) {
    await db
      .update(materialSources)
      .set({ status: "error", lastError: connector.emptyMessage, lastSyncedAt: new Date() })
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
      // summary remis à null : pour une source connectée, c'est la source qui fait foi, pas une
      // édition locale — rupture volontaire avec la règle « l'édition manuelle devient la source de
      // vérité » d'updateMaterialSummary. Le backfill paresseux le regénérera.
      // eventsReadAt aussi : un document qui a changé est à relire par le lecteur d'événements.
      .set({ rawText: doc.rawText, externalChecksum: doc.externalChecksum, title: doc.title, summary: null, eventsReadAt: null })
      .where(eq(sourceMaterials.id, id));
  }

  await db
    .update(materialSources)
    .set({
      lastSyncedAt: new Date(),
      syncCursor: collected.cursor,
      status: "ok",
      // Une ingestion partielle est signalée sans passer la source en "error" : ce n'est pas un échec.
      lastError: collected.truncated ? connector.truncatedMessage : null,
    })
    .where(eq(materialSources.id, sourceId));

  if (diff.toInsert.length > 0 || diff.toUpdate.length > 0) {
    scheduleEventReading(userId, source.productId);
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

/** Crée un sujet et une source par candidat, puis ingère. Un candidat qui échoue n'empêche pas les
 *  autres : le sujet reste, la source porte l'erreur, et l'utilisateur peut resynchroniser plus tard. */
export async function createSourcesFromCandidates(
  userId: string,
  type: MaterialSourceType,
  candidates: ConnectorCandidate[]
): Promise<CreatedSourceResult[]> {
  // Pendant l'onboarding (pas encore de profil), chaque source branchée naît sur son propre sujet
  // puis les sources d'un même projet sont regroupées (docs/SPEC_ONBOARDING_MVP.md §3 bis) : la
  // limite porte alors sur les sources, et celle des sujets s'applique au regroupement final.
  const [existing, profile] = await Promise.all([
    db.query.products.findMany({ where: eq(products.userId, userId), columns: { id: true } }),
    db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { id: true } }),
  ]);
  const limit = profile ? MAX_PRODUCTS : MAX_ONBOARDING_SOURCES;
  if (existing.length + candidates.length > limit) {
    throw new ApiError(400, `Maximum ${limit} ${profile ? "subjects" : "sources"} (${existing.length} already saved).`);
  }

  const results: CreatedSourceResult[] = [];

  for (const candidate of candidates) {
    const [product] = await db
      .insert(products)
      .values({ userId, name: candidate.subjectName, description: candidate.subjectDescription })
      .returning({ id: products.id });

    const [source] = await db
      .insert(materialSources)
      .values({
        userId,
        productId: product.id,
        type,
        externalId: candidate.externalId,
        label: candidate.label,
        config: candidate.config,
      })
      .returning({ id: materialSources.id });

    try {
      const report = await syncSource(userId, source.id);
      results.push({ productId: product.id, sourceId: source.id, label: candidate.label, report, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error("Source ingestion failed (subject and source kept)", error, {
        type,
        label: candidate.label,
      });
      results.push({ productId: product.id, sourceId: source.id, label: candidate.label, report: null, error: message });
    }
  }

  return results;
}

/** Identifiants déjà branchés pour ce type, afin que l'UI de sélection grise les candidats
 *  correspondants : les reconnecter créerait un sujet doublon et violerait l'unicité de
 *  material_sources. */
export async function listConnectedExternalIds(userId: string, type: MaterialSourceType): Promise<Set<string>> {
  const rows = await db.query.materialSources.findMany({
    where: and(eq(materialSources.userId, userId), eq(materialSources.type, type)),
    columns: { externalId: true },
  });
  return new Set(rows.map((row) => row.externalId));
}

/** Les sources sont renvoyées enrichies du nom lisible de leur fournisseur : sans ça, l'UI
 *  générique qui les affiche devrait coder "GitHub" en dur et redeviendrait spécifique. */
export async function listSourcesForProduct(userId: string, productId: string) {
  const rows = await db.query.materialSources.findMany({
    where: and(eq(materialSources.userId, userId), eq(materialSources.productId, productId)),
  });
  return rows.map((row) => ({ ...row, connectorLabel: getConnector(row.type).displayName }));
}

/** Supprime la source ET ses documents miroir (cascade sur sourceMaterials.sourceId). */
export async function deleteSource(userId: string, sourceId: string) {
  const [deleted] = await db
    .delete(materialSources)
    .where(and(eq(materialSources.id, sourceId), eq(materialSources.userId, userId)))
    .returning({ id: materialSources.id });
  if (!deleted) {
    throw new ApiError(404, "Source not found.");
  }
  return deleted;
}

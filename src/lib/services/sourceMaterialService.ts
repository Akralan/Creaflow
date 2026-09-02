import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sourceMaterials, sourceMaterialCitations } from "@/db/schema";
import { annotateUsedSpans } from "@/lib/services/citationMatching";
import { summarizeMaterial } from "@/lib/llm/narrativePrompts";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

/**
 * Corpus de matière première par sujet (docs/SPEC_MATIERE_EDITEUR.md §3). Dépôt gratuit et
 * immédiatement utilisable — pas de traitement asynchrone (le découpage en unités typées testé
 * dans un premier temps perdait la richesse narrative du texte et a été retiré).
 */
async function insertSourceMaterial(
  userId: string,
  kind: (typeof sourceMaterials.$inferInsert)["kind"],
  params: { productId?: string | null; title?: string | null; rawText: string }
) {
  const rawText = params.rawText.trim();
  if (!rawText) {
    throw new ApiError(400, "La matière ne peut pas être vide.");
  }
  const [row] = await db
    .insert(sourceMaterials)
    .values({
      userId,
      productId: params.productId ?? null,
      kind,
      title: params.title?.trim() || null,
      rawText,
    })
    .returning();
  return row;
}

export function createPastedMaterial(
  userId: string,
  params: { productId?: string | null; title?: string | null; rawText: string }
) {
  return insertSourceMaterial(userId, "paste", params);
}

/** Dépôt par fichier .md/.txt (§3.2, anti-scope : pas de parseur PDF). Même pipeline que le collage. */
export function createFileMaterial(
  userId: string,
  params: { productId?: string | null; title?: string | null; rawText: string }
) {
  return insertSourceMaterial(userId, "file", params);
}

/** Matière extraite d'une conversation — interview-chat (§3.7) ou assistant éditorial
 *  (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.2). */
export function createInterviewMaterial(
  userId: string,
  params: { productId?: string | null; title?: string | null; rawText: string }
) {
  return insertSourceMaterial(userId, "interview", params);
}

export async function listMaterialsForSubject(userId: string, productId: string | null) {
  return db.query.sourceMaterials.findMany({
    where: and(
      eq(sourceMaterials.userId, userId),
      productId ? eq(sourceMaterials.productId, productId) : isNull(sourceMaterials.productId)
    ),
    orderBy: desc(sourceMaterials.createdAt),
  });
}

export async function getMaterialForUser(userId: string, materialId: string) {
  const material = await db.query.sourceMaterials.findFirst({
    where: and(eq(sourceMaterials.id, materialId), eq(sourceMaterials.userId, userId)),
  });
  if (!material) {
    throw new ApiError(404, "Matière introuvable.");
  }
  return material;
}

/**
 * Édition d'un document existant (docs/SPEC_ASSISTANT_AGENTIQUE.md §3.2) — titre, rattachement au
 * sujet, et texte. Distinct de {@link updateMaterialSummary}, qui ne touche que le résumé.
 *
 * Deux effets de bord traités ici parce qu'ils seraient silencieux autrement, quand `rawText` change :
 * les positions des citations (matchStart/matchLength) désignent des offsets dans l'ancien texte et
 * surligneraient n'importe quoi — on les efface en gardant l'extrait, forme déjà prévue par la table ;
 * et le résumé décrit l'ancien texte — on le remet à null pour le rendre au backfill paresseux.
 */
export async function updateMaterialForUser(
  userId: string,
  materialId: string,
  fields: { title?: string | null; rawText?: string; productId?: string | null }
) {
  const existing = await getMaterialForUser(userId, materialId);
  const nextText = fields.rawText?.trim();
  if (fields.rawText !== undefined && !nextText) {
    throw new ApiError(400, "La matière ne peut pas être vide.");
  }
  const textChanged = nextText !== undefined && nextText !== existing.rawText;

  const [updated] = await db
    .update(sourceMaterials)
    .set({
      ...(fields.title !== undefined && { title: fields.title?.trim() || null }),
      ...(fields.productId !== undefined && { productId: fields.productId }),
      ...(textChanged && { rawText: nextText, summary: null }),
    })
    .where(and(eq(sourceMaterials.id, materialId), eq(sourceMaterials.userId, userId)))
    .returning();

  if (textChanged) {
    await db
      .update(sourceMaterialCitations)
      .set({ matchStart: null, matchLength: null })
      .where(eq(sourceMaterialCitations.sourceMaterialId, materialId));
  }

  return updated;
}

export async function deleteMaterialForUser(userId: string, materialId: string) {
  const [deleted] = await db
    .delete(sourceMaterials)
    .where(and(eq(sourceMaterials.id, materialId), eq(sourceMaterials.userId, userId)))
    .returning({ id: sourceMaterials.id });
  if (!deleted) {
    throw new ApiError(404, "Matière introuvable.");
  }
  return deleted;
}

/** Édition manuelle du résumé (docs/SPEC_REDACTEUR_EN_CHEF.md §7) — devient la source de vérité :
 *  `summary` n'étant plus null, {@link backfillMaterialSummaries} ne le touchera plus jamais. */
export async function updateMaterialSummary(userId: string, materialId: string, summary: string | null) {
  const [updated] = await db
    .update(sourceMaterials)
    .set({ summary })
    .where(and(eq(sourceMaterials.id, materialId), eq(sourceMaterials.userId, userId)))
    .returning();
  if (!updated) {
    throw new ApiError(404, "Matière introuvable.");
  }
  return updated;
}

/**
 * Résumeur d'UN document (docs/SPEC_REDACTEUR_EN_CHEF.md §3.1) — appelé depuis `after()` juste après
 * l'ingestion (même pattern que `processAssetCaptioning`, brandAssetService.ts) et depuis le backfill
 * ci-dessous. Erreur non capturée ici : l'appelant journalise et le document reste avec `summary`
 * null (retente au prochain backfill), jamais d'état d'échec dédié — pas nécessaire pour un texte.
 */
export async function summarizeMaterialDocument(materialId: string): Promise<void> {
  const material = await db.query.sourceMaterials.findFirst({ where: eq(sourceMaterials.id, materialId) });
  if (!material) return; // supprimé entretemps
  const summary = await summarizeMaterial(material.rawText, material.title);
  await db.update(sourceMaterials).set({ summary }).where(eq(sourceMaterials.id, materialId));
}

/**
 * Backfill paresseux (docs/SPEC_REDACTEUR_EN_CHEF.md §3.1 : "toute planification commence par
 * résumer les docs du sujet dont summary est null, séquentiel"). Appelé depuis
 * `planNarrativeForSubject` (narrativeDirector.ts), en tête de `POST /api/narrative/plan` — le
 * déclencheur natif de la spec (bouton "Planifier la suite"/"Replanifier"). Un déclencheur
 * intermédiaire posé au Lot B1 sur `GET /api/materials` (avant que la planification existe) a été
 * retiré au Lot B2. Séquentiel par sujet : un doc à la fois, pas de Promise.all — ce sont des
 * documents de matière potentiellement longs, pas la peine de saturer le débit du provider LLM.
 */
export async function backfillMaterialSummaries(userId: string, productId: string | null): Promise<void> {
  const pending = await db.query.sourceMaterials.findMany({
    where: and(
      eq(sourceMaterials.userId, userId),
      productId ? eq(sourceMaterials.productId, productId) : isNull(sourceMaterials.productId),
      isNull(sourceMaterials.summary)
    ),
    columns: { id: true },
  });
  for (const m of pending) {
    await summarizeMaterialDocument(m.id).catch((err) =>
      logger.error("Résumé de matière échoué (backfill)", err, { materialId: m.id })
    );
  }
}

export interface SubjectMaterialDocument {
  id: string;
  title: string | null;
  rawText: string;
  /** rawText avec les passages déjà cités par des générations précédentes entourés de marqueurs
   *  (docs/SPEC_MATIERE_EDITEUR.md §3) — c'est ça qui est injecté dans le prompt, jamais rawText nu. */
  annotatedText: string;
}

/**
 * Texte brut complet du sujet (ou de niveau marque si productId est null), annoté des passages déjà
 * cités par des générations précédentes — remplace `getRawMaterialForSubject`/la sélection d'unités.
 * Injecté tel quel dans buildScriptUserMessage : c'est le LLM qui décide quoi utiliser, pas une
 * présélection côté serveur (§3.6 — "petit code, levier énorme").
 */
export async function getMaterialForSubject(
  userId: string,
  productId: string | null
): Promise<SubjectMaterialDocument[]> {
  const materials = await db.query.sourceMaterials.findMany({
    where: and(
      eq(sourceMaterials.userId, userId),
      productId ? eq(sourceMaterials.productId, productId) : isNull(sourceMaterials.productId)
    ),
    orderBy: desc(sourceMaterials.createdAt),
  });
  if (materials.length === 0) return [];

  const citations = await db.query.sourceMaterialCitations.findMany({
    where: and(
      eq(sourceMaterialCitations.userId, userId),
      inArray(sourceMaterialCitations.sourceMaterialId, materials.map((m) => m.id))
    ),
    columns: { sourceMaterialId: true, matchStart: true, matchLength: true },
  });

  return materials.map((m) => {
    const spans = citations
      .filter((c) => c.sourceMaterialId === m.id && c.matchStart !== null && c.matchLength !== null)
      .map((c) => ({ start: c.matchStart!, length: c.matchLength! }));
    return {
      id: m.id,
      title: m.title,
      rawText: m.rawText,
      annotatedText: annotateUsedSpans(m.rawText, spans),
    };
  });
}

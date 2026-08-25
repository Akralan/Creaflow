import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sourceMaterials, sourceMaterialCitations } from "@/db/schema";
import { annotateUsedSpans } from "@/lib/services/citationMatching";
import { ApiError } from "@/lib/api/errors";

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

/** Matière extraite d'une réponse d'interview-chat (§3.7). */
export function createInterviewMaterial(
  userId: string,
  params: { productId?: string | null; rawText: string }
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

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sourceMaterials, sourceMaterialCitations } from "@/db/schema";
import { findBestMatchInText, normalize } from "@/lib/services/citationMatching";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

/**
 * Records the citations reported by the LLM at generation (docs/SPEC_MATIERE_EDITEUR.md §3):
 * for each excerpt, looks for the best match across all of the topic's documents
 * (`findBestMatchInText`), inserts one row per excerpt — matched or not (an unlocated citation
 * remains a useful debug signal, see schema.ts). Accepts `tx` to commit within the same
 * transaction as the script write (createScriptRecord/updateScriptRecord).
 */
export async function recordCitations(
  dbOrTx: DbOrTx,
  userId: string,
  scriptId: string,
  productId: string | null,
  excerpts: string[]
): Promise<void> {
  if (excerpts.length === 0) return;

  const candidates = await dbOrTx.query.sourceMaterials.findMany({
    where: and(
      eq(sourceMaterials.userId, userId),
      productId ? eq(sourceMaterials.productId, productId) : isNull(sourceMaterials.productId)
    ),
  });
  if (candidates.length === 0) return;

  const rows = excerpts.map((excerpt) => {
    let best: { sourceMaterialId: string; start: number; length: number; score: number } | null = null;
    for (const material of candidates) {
      const match = findBestMatchInText(excerpt, material.rawText);
      if (match && (!best || match.score > best.score)) {
        best = { sourceMaterialId: material.id, start: match.start, length: match.length, score: match.score };
      }
    }
    return {
      userId,
      scriptId,
      sourceMaterialId: best?.sourceMaterialId ?? null,
      excerpt,
      matchStart: best?.start ?? null,
      matchLength: best?.length ?? null,
    };
  });

  await dbOrTx.insert(sourceMaterialCitations).values(rows);
}

/** A regeneration makes the previous citations obsolete — same logic as the former
 *  scriptMaterialUsages (delete-then-insert). */
export async function deleteCitationsForScript(dbOrTx: DbOrTx, scriptId: string): Promise<void> {
  await dbOrTx.delete(sourceMaterialCitations).where(eq(sourceMaterialCitations.scriptId, scriptId));
}

/**
 * Reconciliation after a partial edit (selection→instruction) — unlike a full
 * regeneration, an edit only touches one passage: removes only the citations whose
 * excerpt no longer appears in the script's current text (passage deleted/reworded), and records
 * the new excerpts reported by this edit, without touching the citations that remain valid
 * elsewhere in the text.
 */
export async function reconcileCitationsAfterEdit(
  dbOrTx: DbOrTx,
  userId: string,
  scriptId: string,
  productId: string | null,
  currentText: string,
  newExcerpts: string[]
): Promise<void> {
  const existing = await dbOrTx.query.sourceMaterialCitations.findMany({
    where: eq(sourceMaterialCitations.scriptId, scriptId),
  });
  const normalizedCurrent = normalize(currentText);
  const staleIds = existing.filter((c) => !normalizedCurrent.includes(normalize(c.excerpt))).map((c) => c.id);
  if (staleIds.length > 0) {
    await dbOrTx.delete(sourceMaterialCitations).where(inArray(sourceMaterialCitations.id, staleIds));
  }
  if (newExcerpts.length > 0) {
    await recordCitations(dbOrTx, userId, scriptId, productId, newExcerpts);
  }
}

/**
 * Citations of a script, in the exact shape expected by the front end (`apiClient.ts::Citation`,
 * same mapping as `GET /api/scripts/:id`). Used by the micro-edit gestures
 * (`microEditService.ts`) to return an up-to-date state: `patchScriptContent` (scriptService.ts) only
 * returns the `scripts` columns, never the joined relations — without this explicit call, the
 * "Material used" panel of the editor shows the pre-edit citations until the next
 * full page reload (the front-end `{...prev, ...updated}` merge does not touch
 * `citations` if the response does not carry that key).
 */
export async function getCitationsForScript(dbOrTx: DbOrTx, scriptId: string) {
  const citations = await dbOrTx.query.sourceMaterialCitations.findMany({
    where: eq(sourceMaterialCitations.scriptId, scriptId),
    with: { sourceMaterial: { columns: { title: true } } },
  });
  return citations.map((c) => ({
    id: c.id,
    sourceMaterialId: c.sourceMaterialId,
    sourceMaterialTitle: c.sourceMaterial?.title ?? null,
    excerpt: c.excerpt,
    matched: c.matchStart !== null,
  }));
}

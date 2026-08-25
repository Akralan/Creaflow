import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sourceMaterials, sourceMaterialCitations } from "@/db/schema";
import { findBestMatchInText, normalize } from "@/lib/services/citationMatching";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = typeof db | Tx;

/**
 * Enregistre les citations rapportées par le LLM à la génération (docs/SPEC_MATIERE_EDITEUR.md §3) :
 * pour chaque extrait, cherche la meilleure correspondance tous documents du sujet confondus
 * (`findBestMatchInText`), insère une ligne par extrait — matchée ou non (une citation non localisée
 * reste un signal de debug utile, cf. schema.ts). Accepte `tx` pour committer dans la même
 * transaction que l'écriture du script (createScriptRecord/updateScriptRecord).
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

/** Une régénération rend les citations précédentes obsolètes — même logique que l'ancien
 *  scriptMaterialUsages (delete-then-insert). */
export async function deleteCitationsForScript(dbOrTx: DbOrTx, scriptId: string): Promise<void> {
  await dbOrTx.delete(sourceMaterialCitations).where(eq(sourceMaterialCitations.scriptId, scriptId));
}

/**
 * Réconciliation après une édition partielle (sélection→instruction) — contrairement à une
 * régénération complète, une édition ne touche qu'un passage : retire seulement les citations dont
 * l'extrait n'apparaît plus dans le texte actuel du script (passage supprimé/reformulé), et enregistre
 * les nouveaux extraits rapportés par cette édition, sans toucher aux citations qui restent valides
 * ailleurs dans le texte.
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
 * Citations d'un script, dans la forme exacte attendue par le front (`apiClient.ts::Citation`,
 * même mapping que `GET /api/scripts/:id`). Utilisé par les gestes de micro-retouche
 * (`microEditService.ts`) pour renvoyer un état à jour : `patchScriptContent` (scriptService.ts) ne
 * renvoie que les colonnes de `scripts`, jamais les relations jointes — sans cet appel explicite, le
 * panneau "Matière utilisée" de l'éditeur affiche les citations d'avant l'édition jusqu'au prochain
 * rechargement complet de la page (le merge `{...prev, ...updated}` côté front ne touche pas
 * `citations` si la réponse ne porte pas cette clé).
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

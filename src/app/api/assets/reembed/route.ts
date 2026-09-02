import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { recomputeAssetEmbeddingsForUser } from "@/lib/services/brandAssetService";
import { handleApiError } from "@/lib/api/errors";

/**
 * Recalcul one-shot des embeddings de la bibliothèque visuelle, à lancer après un changement de
 * modèle d'embedding (docs/SPEC_RESSOURCES_VISUELLES.md §8.4). Repart des descriptions déjà en base :
 * aucun appel vision, donc quasi gratuit.
 *
 * Pas d'écran dédié — c'est une opération de maintenance rare, appelée à la main :
 *   curl -X POST http://localhost:3000/api/assets/reembed -b "<cookie de session>"
 */
export async function POST() {
  try {
    const userId = await requireUserId();
    return NextResponse.json(await recomputeAssetEmbeddingsForUser(userId));
  } catch (error) {
    return handleApiError(error);
  }
}

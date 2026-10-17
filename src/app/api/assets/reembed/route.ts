import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { recomputeAssetEmbeddingsForUser } from "@/lib/services/brandAssetService";
import { handleApiError } from "@/lib/api/errors";

/**
 * One-shot recomputation of the visual library embeddings, to run after the embedding model
 * changes (docs/SPEC_RESSOURCES_VISUELLES.md §8.4). Starts again from the descriptions already in the database:
 * no vision call, so nearly free.
 *
 * No dedicated screen — it is a rare maintenance operation, called by hand:
 *   curl -X POST http://localhost:3000/api/assets/reembed -b "<session cookie>"
 */
export async function POST() {
  try {
    const userId = await requireUserId();
    return NextResponse.json(await recomputeAssetEmbeddingsForUser(userId));
  } catch (error) {
    return handleApiError(error);
  }
}

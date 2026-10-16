import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { ensureCutoutForUser, toApiAsset } from "@/lib/services/brandAssetService";

/**
 * Détourage d'une photo de la bibliothèque (docs/SPEC_COMPOSITION_VISUELLE.md §5.3) — calculé une
 * fois, mis en cache sur R2. 503 explicite si aucun provider n'est configuré.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    // Appel externe payant — même limite que la composition.
    await enforceRateLimit("asset-cutout", userId, 10, 60);
    const asset = await ensureCutoutForUser(userId, id);
    return NextResponse.json({ asset: toApiAsset(asset) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

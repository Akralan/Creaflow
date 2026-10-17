import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { ensureCutoutForUser, toApiAsset } from "@/lib/services/brandAssetService";

/**
 * Background removal for a library photo (docs/SPEC_COMPOSITION_VISUELLE.md §5.3) — computed once,
 * cached on R2. Explicit 503 if no provider is configured.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    // Paid external call — same limit as composition.
    await enforceRateLimit("asset-cutout", userId, 10, 60);
    const asset = await ensureCutoutForUser(userId, id);
    return NextResponse.json({ asset: toApiAsset(asset) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { framingSignatureRequestSchema, getFramingSignature } from "@/lib/services/seriesFramingService";

/** Signature proposée après les trois choix (docs/SPEC_CADRAGE_SERIE.md Annexe A.3). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("series-framing", userId, 40, 60 * 60);
    const { id } = await params;
    return NextResponse.json(await getFramingSignature(userId, id, framingSignatureRequestSchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}

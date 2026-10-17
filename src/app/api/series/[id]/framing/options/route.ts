import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { framingOptionsRequestSchema, getFramingOptions } from "@/lib/services/seriesFramingService";

/** Trois options et leurs extraits pour une étape du cadrage (docs/SPEC_CADRAGE_SERIE.md §3). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("series-framing", userId, 40, 60 * 60);
    const { id } = await params;
    return NextResponse.json(await getFramingOptions(userId, id, framingOptionsRequestSchema.parse(await request.json())));
  } catch (error) {
    return handleApiError(error);
  }
}

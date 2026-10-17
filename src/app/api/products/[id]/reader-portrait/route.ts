import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { readerPortraitEditSchema, regenerateReaderPortrait, saveReaderPortrait } from "@/lib/services/readerPortraitService";

/** "Redo the portrait" (docs/SPEC_PROMPT_GENERATION_V3.md §2.2): replaces even a hand-corrected portrait. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("reader-portrait", userId, 20, 60 * 60);
    const { id } = await params;
    const readerPortrait = await regenerateReaderPortrait(userId, id);
    return NextResponse.json({ readerPortrait });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Hand correction of the portrait: it is no longer replaced automatically afterwards. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { readers } = readerPortraitEditSchema.parse(await request.json());
    const readerPortrait = await saveReaderPortrait(userId, id, readers);
    return NextResponse.json({ readerPortrait });
  } catch (error) {
    return handleApiError(error);
  }
}

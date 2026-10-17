import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { listInspirations, runInspirationResearch } from "@/lib/services/inspirationService";

/** Inspiration cards of the topic, active then dismissed (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.4). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await listInspirations(userId, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** "Start a watch": web search then turned into cards, live (the author waits for the result). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("inspiration-research", userId, 10, 60 * 60);
    const { id } = await params;
    return NextResponse.json(await runInspirationResearch(userId, id));
  } catch (error) {
    return handleApiError(error);
  }
}

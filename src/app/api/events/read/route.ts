import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { readEventsForSubject } from "@/lib/services/materialEventService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({ productId: z.uuid() });

/**
 * "Re-read the material" button (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3): reads the topic's documents
 * not yet read and records their events. Synchronous: the response arrives when the reading is
 * done, with its report. Several minutes possible on a large topic.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("events-read", userId, 5, 60);
    const { productId } = schema.parse(await request.json());
    const report = await readEventsForSubject(userId, productId);
    return NextResponse.json({ report });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { qualifyEventsForSubject } from "@/lib/services/materialEventService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({ productId: z.uuid() });

/** Reassigns an audience to all of the topic's events based on its reader portrait (synchronous, one call per batch of 60). */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("events-qualify", userId, 5, 60);
    const { productId } = schema.parse(await request.json());
    const qualified = await qualifyEventsForSubject(userId, productId);
    return NextResponse.json({ qualified });
  } catch (error) {
    return handleApiError(error);
  }
}

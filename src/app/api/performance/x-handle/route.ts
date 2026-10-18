import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { xHandleSchema } from "@/lib/validation";

const schema = z.object({ handle: xHandleSchema });

/**
 * Connects X from the Performance screen by giving its handle (docs/SPEC_PERFORMANCE.md §4): the public numbers
 * of that handle are what gets read. An empty handle disconnects. A new handle is a new timeline, so the read
 * throttle is reset.
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("performance-x-handle", userId, 10, 60);
    const { handle } = schema.parse(await request.json());

    const [profile] = await db
      .update(creatorProfiles)
      .set({ xHandle: handle, xLastReadAt: null })
      .where(eq(creatorProfiles.userId, userId))
      .returning({ xHandle: creatorProfiles.xHandle });
    if (!profile) throw new ApiError(409, "Finish setting up your profile first.");

    return NextResponse.json({ xHandle: profile.xHandle });
  } catch (error) {
    return handleApiError(error);
  }
}

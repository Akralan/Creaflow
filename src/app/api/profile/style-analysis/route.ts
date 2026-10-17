import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { getStyleLearningStatus, runStyleLearningPass } from "@/lib/services/styleLearningService";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const schema = z.object({
  // true = also replays scripts already learned from (manual rebuild of the profile).
  includeLearned: z.boolean().optional(),
});

/**
 * Style learning pass (docs/SPEC_APPRENTISSAGE_STYLE.md §5.3). Creates a proposal to
 * validate, unless there was no profile (direct write). Returns the current profile and the state
 * of the counter so the screen updates without a second call.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Costly analysis (one LLM call over up to 20 scripts) — low limit.
    await enforceRateLimit("style-analysis", userId, 5, 60);
    const text = await request.text();
    const body = schema.parse(text ? JSON.parse(text) : {});
    const result = await runStyleLearningPass(userId, { includeLearned: body.includeLearned });
    const profile = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.userId, userId),
    });
    const styleLearning = await getStyleLearningStatus(userId);
    return NextResponse.json({
      profile,
      styleLearning,
      proposalId: result.proposalId,
      changeNotes: result.changeNotes,
      proposedStyleProfile: result.styleProfile,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

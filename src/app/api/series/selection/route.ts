import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { confirmSeriesSelection } from "@/lib/services/seriesSelectionService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({ keptIds: z.array(z.uuid()).min(1, "Keep at least one series.") });

/** Validation of the series on Direction after onboarding: archives the unchecked ones, recomputes the
 *  percentages, schedules the main series (one LLM call). */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("series-selection", userId, 10, 60 * 60);
    const { keptIds } = schema.parse(await request.json());
    return NextResponse.json(await confirmSeriesSelection(userId, keptIds));
  } catch (error) {
    return handleApiError(error);
  }
}

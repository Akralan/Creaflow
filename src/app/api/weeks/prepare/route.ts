import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { requestWeekPreparation } from "@/lib/services/postWriteService";
import { generateOtherPosts } from "@/lib/services/startJobService";

const schema = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** « Prepare next week » : écrit, en fond, les posts d'une semaine (docs/SPEC_APP_DESIGN_TELLOVO.md E11). */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("week-prepare", userId, 6, 60);
    const { weekStart } = schema.parse(await request.json());
    const posts = await requestWeekPreparation(userId, new Date(`${weekStart}T00:00:00.000Z`));
    after(() => generateOtherPosts(userId));
    return NextResponse.json({ ok: true, posts }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}

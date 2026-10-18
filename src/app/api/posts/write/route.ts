import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { requestPostWrite } from "@/lib/services/postWriteService";
import { generateOtherPosts } from "@/lib/services/startJobService";

const schema = z.object({ entryId: z.uuid() });

/** Écrit le post d'un créneau vide, pour les deux réseaux, en fond (docs/SPEC_APP_DESIGN_TELLOVO.md E2). */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("script-generate", userId, 20, 60);
    const { entryId } = schema.parse(await request.json());
    await requestPostWrite(userId, entryId);
    after(() => generateOtherPosts(userId));
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}

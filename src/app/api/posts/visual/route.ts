import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { postVisualSchema, removePostVisual, setPostVisual } from "@/lib/services/postVisualService";

/** Adds or changes the visual of a post (docs/SPEC_APP_DESIGN_TELLOVO.md E16). Composes the mockup before answering. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("post-visual", userId, 10, 60);
    const scriptId = await setPostVisual(userId, postVisualSchema.parse(await request.json()));
    return NextResponse.json({ ok: true, scriptId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Takes the visual off a post: it is text again. */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const scriptId = z.uuid().parse(new URL(request.url).searchParams.get("scriptId"));
    await removePostVisual(userId, scriptId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

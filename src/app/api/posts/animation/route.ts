import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import {
  createPostAnimation,
  getPlayableAnimation,
  postAnimationSchema,
  removePostAnimation,
  reviseAnimationSchema,
  revisePostAnimation,
} from "@/lib/services/postAnimationService";

// Writing an animation is a long model call (a few tens of seconds).
export const maxDuration = 120;

const scriptIdSchema = z.uuid();

/** The animation of a post as the page the browser plays (docs/SPEC_ANIMATION_HTML_LIBRE.md), or null. */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const scriptId = scriptIdSchema.parse(request.nextUrl.searchParams.get("scriptId"));
    return NextResponse.json({ animation: await getPlayableAnimation(userId, scriptId) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Writes the animation of a post. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("post-animation", userId, 12, 60);
    const scriptId = await createPostAnimation(userId, postAnimationSchema.parse(await request.json()));
    return NextResponse.json({ animation: await getPlayableAnimation(userId, scriptId) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Corrects the animation with what the rendering test found in the browser. */
export async function PUT(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("post-animation-fix", userId, 30, 60);
    const scriptId = await revisePostAnimation(userId, reviseAnimationSchema.parse(await request.json()));
    return NextResponse.json({ animation: await getPlayableAnimation(userId, scriptId) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await removePostAnimation(userId, scriptIdSchema.parse(new URL(request.url).searchParams.get("scriptId")));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

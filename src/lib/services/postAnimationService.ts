import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { creatorProfiles, postAnimations, scriptMicroEditEvents } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { buildPlayerDocument } from "@/lib/animationHtml/player";
import { loadPlayerFonts } from "@/lib/animationHtml/fonts";
import { generateAnimationHtml, reviseAnimationHtml, type AnimationRequest, type AnimationResult } from "@/lib/llm/animationHtml";
import { parseStoredStyleProfile } from "@/lib/llm/styleProfile";
import { logger } from "@/lib/logger";
import { enforceMicroEditQuota } from "@/lib/services/billingService";
import { visualOwnerOf } from "@/lib/services/postVisualService";
import { designFontNames } from "@/lib/visualDesign/fonts";
import { MAX_DURATION_MS, MIN_DURATION_MS } from "@/lib/visualDesign/visualFormat";

/**
 * The animation of a post (docs/SPEC_ANIMATION_HTML_LIBRE.md): written by the model as a free HTML page, stored as
 * is, played in a sealed iframe. Like a static visual it hangs on the first version of the post (LinkedIn) and the
 * other network reads it (docs/SPEC_APP_DESIGN_TELLOVO.md E16).
 */

export const ANIMATION_WIDTH = 1080;
export const ANIMATION_HEIGHT = 1920;

export const postAnimationSchema = z.object({
  scriptId: z.uuid(),
  durationMs: z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS).default(8000),
});

export const reviseAnimationSchema = z.object({
  scriptId: z.uuid(),
  issues: z.array(z.string().max(600)).min(1).max(8),
});

const LANGUAGE_NAMES: Record<string, string> = { fr: "French", en: "English" };

export async function animationRequestFor(userId: string, owner: Awaited<ReturnType<typeof visualOwnerOf>>, durationMs: number): Promise<AnimationRequest> {
  const text = owner.caption?.trim() ?? "";
  if (!text) throw new ApiError(409, "This post has no text yet: write it first.");
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  return {
    post: { title: owner.title, text, platform: owner.platform },
    brand: { name: profile?.brandName || "Your brand", tone: parseStoredStyleProfile(profile?.styleProfile)?.tone ?? null },
    width: ANIMATION_WIDTH,
    height: ANIMATION_HEIGHT,
    durationMs,
    fontNames: designFontNames(),
    language: profile?.language ? (LANGUAGE_NAMES[profile.language] ?? null) : null,
  };
}

/** Stores the page the model wrote (the first one, or a correction of it). */
export async function savePostAnimation(userId: string, scriptId: string, durationMs: number, result: AnimationResult) {
  const values = { html: result.html, durationMs, width: ANIMATION_WIDTH, height: ANIMATION_HEIGHT, concept: result.concept, beats: result.beats, updatedAt: new Date() };
  await db
    .insert(postAnimations)
    .values({ userId, scriptId, ...values })
    .onConflictDoUpdate({ target: postAnimations.scriptId, set: values });
}

/** Writes (or rewrites) the animation of a post. About 20 to 40 seconds. */
export async function createPostAnimation(userId: string, input: z.infer<typeof postAnimationSchema>) {
  const owner = await visualOwnerOf(userId, input.scriptId);
  await enforceMicroEditQuota(userId);
  const request = await animationRequestFor(userId, owner, input.durationMs);
  const result = await generateAnimationHtml(request).catch((error) => {
    logger.error("Animation of a post failed", error, { userId, scriptId: owner.id });
    throw new ApiError(502, "The animation could not be made. Try again.");
  });
  await savePostAnimation(userId, owner.id, input.durationMs, result);
  await db.insert(scriptMicroEditEvents).values({ userId, scriptId: owner.id, kind: "design_instruction" });
  return owner.id;
}

/** The page the rendering test (run in the browser, in the sealed iframe) refused goes back to the model with the findings. */
export async function revisePostAnimation(userId: string, input: z.infer<typeof reviseAnimationSchema>) {
  const owner = await visualOwnerOf(userId, input.scriptId);
  const existing = await db.query.postAnimations.findFirst({ where: and(eq(postAnimations.scriptId, owner.id), eq(postAnimations.userId, userId)) });
  if (!existing) throw new ApiError(404, "This post has no animation.");
  const request = await animationRequestFor(userId, owner, existing.durationMs);
  const result = await reviseAnimationHtml(request, { html: existing.html }, input.issues).catch((error) => {
    logger.error("Animation correction failed", error, { userId, scriptId: owner.id });
    throw new ApiError(502, "The animation could not be corrected.");
  });
  await savePostAnimation(userId, owner.id, existing.durationMs, result);
  return owner.id;
}

export async function removePostAnimation(userId: string, scriptId: string) {
  const owner = await visualOwnerOf(userId, scriptId);
  await db.delete(postAnimations).where(and(eq(postAnimations.scriptId, owner.id), eq(postAnimations.userId, userId)));
}

export interface PlayableAnimation {
  /** The owner script (the post's first version). */
  scriptId: string;
  /** The whole page, ready for the sealed iframe's `srcdoc`. */
  document: string;
  durationMs: number;
  width: number;
  height: number;
  concept: string;
  beats: Array<{ fromMs: number; toMs: number; shows: string; motion: string }>;
}

/** The animation of the post holding `scriptId`, as the page the browser plays; null when it has none. */
export async function getPlayableAnimation(userId: string, scriptId: string): Promise<PlayableAnimation | null> {
  const owner = await visualOwnerOf(userId, scriptId);
  const row = await db.query.postAnimations.findFirst({ where: and(eq(postAnimations.scriptId, owner.id), eq(postAnimations.userId, userId)) });
  if (!row) return null;
  const fonts = await loadPlayerFonts();
  return {
    scriptId: owner.id,
    document: buildPlayerDocument(row.html, { width: row.width, height: row.height, durationMs: row.durationMs, fonts }),
    durationMs: row.durationMs,
    width: row.width,
    height: row.height,
    concept: row.concept,
    beats: row.beats as PlayableAnimation["beats"],
  };
}

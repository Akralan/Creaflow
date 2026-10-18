import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { calendarEntries, scriptMicroEditEvents, scripts } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { storyboardFromText } from "@/lib/llm/storyboardFromText";
import { enforceMicroEditQuota } from "@/lib/services/billingService";
import { entriesOfPost } from "@/lib/services/postPairService";
import { createDesignForScript, deleteDesign, getDesignForScript, suggestDesignAssets } from "@/lib/services/visualDesignService";
import { MAX_DURATION_MS, MAX_SLIDES, MIN_DURATION_MS, MIN_SLIDES, normalizeVisualSpec, VISUAL_FORMATS } from "@/lib/visualDesign/visualFormat";

/**
 * The visual of a post, chosen post by post from the tools bubble (docs/SPEC_APP_DESIGN_TELLOVO.md E16). The text of
 * the post does not change; the mockup is shared by both networks, so it hangs on one script — the first
 * version of the post, LinkedIn — and the other version reads it.
 */

export const postVisualSchema = z.object({
  scriptId: z.uuid(),
  visualFormat: z.enum(VISUAL_FORMATS),
  slideCount: z.number().int().min(MIN_SLIDES).max(MAX_SLIDES).optional(),
  durationMs: z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS).optional(),
});
export type PostVisualInput = z.infer<typeof postVisualSchema>;

/** The script that carries the visual of the post holding `scriptId`: its first version (LinkedIn), the script itself if it sits alone. */
export async function visualOwnerOf(userId: string, scriptId: string) {
  const own = await db.query.scripts.findFirst({ where: and(eq(scripts.id, scriptId), eq(scripts.userId, userId)) });
  if (!own) throw new ApiError(404, "Script not found.");
  const entry = await db.query.calendarEntries.findFirst({ where: and(eq(calendarEntries.scriptId, scriptId), eq(calendarEntries.userId, userId)) });
  if (!entry) return own;
  const first = (await entriesOfPost(userId, entry)).find((e) => e.scriptId);
  if (!first?.scriptId || first.scriptId === own.id) return own;
  return (await db.query.scripts.findFirst({ where: and(eq(scripts.id, first.scriptId), eq(scripts.userId, userId)) })) ?? own;
}

/** Adds (or changes) the visual of a post: brief from the text, then the mockup composed from the library's photos. */
export async function setPostVisual(userId: string, input: PostVisualInput) {
  const owner = await visualOwnerOf(userId, input.scriptId);
  const text = owner.caption?.trim() ?? "";
  if (!text) throw new ApiError(409, "This post has no text yet: write it first.");
  await enforceMicroEditQuota(userId);

  const spec = normalizeVisualSpec({ visualFormat: input.visualFormat, slideCount: input.slideCount, durationMs: input.durationMs });
  const brief = await storyboardFromText({ platform: owner.platform, title: owner.title, text, spec }).catch((error) => {
    throw error instanceof ApiError ? error : new ApiError(502, "The visual could not be designed. Try again.");
  });

  // Changing format: the earlier mockup goes first (one mockup per script).
  if (await getDesignForScript(userId, owner.id)) await deleteDesign(userId, owner.id);

  const before = { contentType: owner.contentType, visualFormat: owner.visualFormat, slideCount: owner.slideCount, durationMs: owner.durationMs, hookVisual: owner.hookVisual, storyboard: owner.storyboard };
  await db
    .update(scripts)
    .set({ contentType: "visual", visualFormat: spec.format, slideCount: spec.slideCount, durationMs: spec.durationMs, hookVisual: brief.hookVisual, storyboard: brief.storyboard, updatedAt: new Date() })
    .where(eq(scripts.id, owner.id));
  try {
    const suggested = await suggestDesignAssets(userId, { brandAssetId: owner.brandAssetId, productId: owner.productId }).catch(() => []);
    await createDesignForScript(userId, owner.id, { assetIds: suggested.map((a) => a.id) });
  } catch (error) {
    // No mockup, no visual: the post goes back to what it was.
    await db.update(scripts).set({ ...before, updatedAt: new Date() }).where(eq(scripts.id, owner.id));
    throw error instanceof ApiError ? error : new ApiError(502, "The image could not be composed. Try again.");
  }
  await db.insert(scriptMicroEditEvents).values({ userId, scriptId: owner.id, kind: "design_instruction" });
  return owner.id;
}

/** Takes the visual off a post: the mockup goes, the post is text again, its words untouched. */
export async function removePostVisual(userId: string, scriptId: string) {
  const owner = await visualOwnerOf(userId, scriptId);
  if (await getDesignForScript(userId, owner.id)) await deleteDesign(userId, owner.id);
  await db
    .update(scripts)
    .set({ contentType: "text", visualFormat: "single", slideCount: null, durationMs: null, hookVisual: null, storyboard: null, updatedAt: new Date() })
    .where(eq(scripts.id, owner.id));
  return owner.id;
}

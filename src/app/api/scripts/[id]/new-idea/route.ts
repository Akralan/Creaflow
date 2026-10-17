import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { generateScript } from "@/lib/llm/generateScript";
import type { Platform } from "@/lib/llm/prompts";
import { buildGenerationContext, updateScriptRecord } from "@/lib/services/scriptService";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { directiveSchema } from "@/lib/validation";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { visualSpecFromScript } from "@/lib/visualDesign/visualFormat";

const schema = z.object({ directive: directiveSchema });

/**
 * "Another idea, same brief" (docs/SPEC_PROMPT_GENERATION_TECH.md §6) — replaces the disabled
 * full regeneration (POST /api/scripts/:id/regenerate, still present in code but disabled
 * on the product side). Unlike that regenerate, the gesture is DIRECTED: the brief is fully
 * locked (angle kept, not recomputed — §6.1 point 3) and the discarded concept is remembered so
 * as not to come back to it (rejectedConcepts, injected on the next turn).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    // Same full LLM call as a generation or the former regenerate — same shared limit.
    await enforceRateLimit("script-generate", userId, 20, 60);
    const { id } = await params;
    // Optional body ("idea in mind" field / select-all toggle, docs/SPEC_REDACTEUR_EN_CHEF.md Lot A)
    // — a missing body stays valid, as before the directive was added.
    const { directive } = schema.parse(await request.json().catch(() => ({})));
    await enforceScriptQuota(userId);

    const existing = await db.query.scripts.findFirst({
      where: and(eq(scripts.id, id), eq(scripts.userId, userId)),
    });
    if (!existing) {
      throw new ApiError(404, "Script not found.");
    }
    // §6.1 point 1: an imported/manual script has no AI intent to replace.
    if (existing.origin !== "generated" || !existing.concept) {
      throw new ApiError(409, "This script has no generated concept to replace.");
    }

    // §6.1 point 2: the concept about to be replaced joins the list of rejected ones — computed
    // before the LLM call (and before the chief picks the day, to whom it is also passed, §3.3) but
    // persisted only if the generation succeeds (updateScriptRecord below), so as to write nothing
    // if the call fails.
    const rejectedConcepts = [...((existing.rejectedConcepts as string[] | null) ?? []), existing.concept];

    // Fully locked brief: angle kept (lockedAngleId) as fallback without a chief, nothing
    // else changes compared to a normal generation — platform/category/series/product
    // reread from the script. The chief, if active, may propose a new direction (and thus
    // a new angleHint) — "another idea" is no longer a simple rewording with an identical brief
    // once the chief decides (docs/SPEC_REDACTEUR_EN_CHEF.md §4.1, Lot B3).
    const context = await buildGenerationContext(
      userId,
      existing.platform as Platform,
      existing.contentCategoryId,
      existing.contentType,
      existing.productId,
      existing.id,
      existing.seriesId,
      existing.angleId,
      directive,
      rejectedConcepts,
      visualSpecFromScript(existing)
    );
    context.rejectedConcepts = rejectedConcepts;

    const generated = await generateScript(context);
    const script = await updateScriptRecord(userId, existing.id, context.contentCategory, generated, {
      angleId: context.angle?.id ?? null,
      brandAssetId: context.brandAsset?.id ?? null,
      rejectedConcepts,
      // Script.productId stays locked (existing.productId, never rewritten) but the citations
      // must cover the same corpus as the one actually read (inherited from the series topic
      // when this script has none itself, docs/SPEC_REDACTEUR_EN_CHEF.md, topic selector).
      citationsProductId: context.resolvedProductId ?? null,
    });

    return NextResponse.json({ script });
  } catch (error) {
    return handleApiError(error);
  }
}

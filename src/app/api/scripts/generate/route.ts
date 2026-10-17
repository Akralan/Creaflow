import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { generateScript } from "@/lib/llm/generateScript";
import { defaultContentTypeForPlatform } from "@/lib/llm/prompts";
import { buildGenerationContext, createScriptRecord } from "@/lib/services/scriptService";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { contentTypeSchema, directiveSchema } from "@/lib/validation";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { autoComposeDesign } from "@/lib/services/visualDesignService";
import { refreshInspirationsIfStale } from "@/lib/services/inspirationService";
import { normalizeVisualSpec, visualFormatFieldsSchema } from "@/lib/visualDesign/visualFormat";

const schema = z
  .object({
    calendarEntryId: z.uuid(),
    contentType: contentTypeSchema.optional(),
    productId: z.uuid().optional(),
    directive: directiveSchema,
  })
  // Visual post format (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §2) — ignored outside "visual".
  .extend(visualFormatFieldsSchema.shape);

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Each script generation costs an LLM call — limit shared with the other generation routes.
    await enforceRateLimit("script-generate", userId, 20, 60);
    const body = schema.parse(await request.json());
    const { calendarEntryId, contentType, productId, directive } = body;
    await enforceScriptQuota(userId);

    const entry = await db.query.calendarEntries.findFirst({
      where: and(eq(calendarEntries.id, calendarEntryId), eq(calendarEntries.userId, userId)),
    });
    if (!entry) {
      throw new ApiError(404, "Calendar slot not found.");
    }
    if (entry.scriptId) {
      throw new ApiError(409, "This slot already has an associated script.");
    }

    const resolvedContentType = contentType ?? defaultContentTypeForPlatform(entry.platform);
    const context = await buildGenerationContext(
      userId,
      entry.platform,
      entry.contentCategoryId,
      resolvedContentType,
      productId ?? null,
      undefined,
      entry.seriesId,
      undefined,
      directive,
      undefined,
      resolvedContentType === "visual" ? normalizeVisualSpec(body) : null
    );
    const generated = await generateScript(context);
    // resolvedProductId (not the raw productId): inherits the topic linked to the series when no topic
    // was chosen for this specific slot (docs/SPEC_REDACTEUR_EN_CHEF.md, topic selector).
    const script = await createScriptRecord(userId, entry.platform, context.contentCategory, context.resolvedProductId ?? null, generated, {
      angleId: context.angle?.id ?? null,
      seriesId: context.series?.id ?? null,
      brandAssetId: context.brandAsset?.id ?? null,
      eventId: context.eventBrief?.event.id ?? null,
      visual: context.visual,
    });

    await db.update(calendarEntries).set({ scriptId: script.id }).where(eq(calendarEntries.id, entry.id));
    // Mockup composed automatically in the background for a visual post
    // (docs/SPEC_COMPOSITION_VISUELLE.md §2) — never blocking, never counted in the quota.
    if (script.contentType === "visual") after(() => autoComposeDesign(userId, script.id));
    // Inspiration watch of the topic relaunched in the background if it is more than 7 days old
    // (docs/SPEC_MEMOIRE_ET_VEILLE.md §1) — never blocking, no effect otherwise.
    after(() => refreshInspirationsIfStale(userId, context.resolvedProductId ?? null));

    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

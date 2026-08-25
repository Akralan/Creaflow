import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { generateScript } from "@/lib/llm/generateScript";
import { defaultContentTypeForPlatform } from "@/lib/llm/prompts";
import { buildGenerationContext, createScriptRecord, recordBeatDraftedIfNeeded } from "@/lib/services/scriptService";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { contentTypeSchema, directiveSchema } from "@/lib/validation";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const schema = z.object({
  calendarEntryId: z.uuid(),
  contentType: contentTypeSchema.optional(),
  productId: z.uuid().optional(),
  directive: directiveSchema,
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Chaque génération de script coûte un appel LLM — limite partagée avec les autres routes de génération.
    await enforceRateLimit("script-generate", userId, 20, 60);
    const { calendarEntryId, contentType, productId, directive } = schema.parse(await request.json());
    await enforceScriptQuota(userId);

    const entry = await db.query.calendarEntries.findFirst({
      where: and(eq(calendarEntries.id, calendarEntryId), eq(calendarEntries.userId, userId)),
    });
    if (!entry) {
      throw new ApiError(404, "Créneau calendrier introuvable.");
    }
    if (entry.scriptId) {
      throw new ApiError(409, "Ce créneau a déjà un script associé.");
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
      directive
    );
    const generated = await generateScript(context);
    const script = await createScriptRecord(userId, entry.platform, context.contentCategory, productId ?? null, generated, {
      angleId: context.angle?.id ?? null,
      seriesId: context.series?.id ?? null,
      brandAssetId: context.brandAsset?.id ?? null,
      beatId: context.direction?.beatId ?? null,
    });
    await recordBeatDraftedIfNeeded(context, script.id);

    await db.update(calendarEntries).set({ scriptId: script.id }).where(eq(calendarEntries.id, entry.id));

    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

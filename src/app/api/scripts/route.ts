import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, scripts } from "@/db/schema";
import { generateScript } from "@/lib/llm/generateScript";
import { requireUserId } from "@/lib/auth/session";
import { buildGenerationContext, createScriptRecord, recordBeatDraftedIfNeeded } from "@/lib/services/scriptService";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { platformSchema, contentCategorySchema, contentTypeSchema, directiveSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const schema = z.object({
  platform: platformSchema,
  contentCategoryId: contentCategorySchema,
  contentType: contentTypeSchema,
  productId: z.uuid().optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD").optional(),
  seriesId: z.uuid().optional(),
  directive: directiveSchema,
});

const listSchema = z.object({ seriesId: z.uuid().optional() });

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { seriesId } = listSchema.parse({ seriesId: request.nextUrl.searchParams.get("seriesId") ?? undefined });

    const scriptsList = await db.query.scripts.findMany({
      where: and(eq(scripts.userId, userId), seriesId ? eq(scripts.seriesId, seriesId) : undefined),
      with: {
        contentCategory: { columns: { id: true, label: true } },
        series: { columns: { id: true, label: true } },
      },
      orderBy: desc(scripts.createdAt),
      limit: 200,
    });

    return NextResponse.json({ scripts: scriptsList });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Chaque génération de script coûte un appel LLM — limite partagée avec les autres routes de génération.
    await enforceRateLimit("script-generate", userId, 20, 60);
    const { platform, contentCategoryId, contentType, productId, scheduledDate, seriesId, directive } = schema.parse(
      await request.json()
    );
    await enforceScriptQuota(userId);

    const context = await buildGenerationContext(
      userId,
      platform,
      contentCategoryId,
      contentType,
      productId,
      undefined,
      seriesId ?? null,
      undefined,
      directive
    );
    const generated = await generateScript(context);
    // resolvedProductId (pas productId brut) : hérite du sujet lié à la série quand aucun sujet
    // n'a été choisi pour cette génération précise (docs/SPEC_REDACTEUR_EN_CHEF.md, sélecteur de sujet).
    const script = await createScriptRecord(userId, platform, context.contentCategory, context.resolvedProductId ?? null, generated, {
      angleId: context.angle?.id ?? null,
      seriesId: context.series?.id ?? null,
      brandAssetId: context.brandAsset?.id ?? null,
      beatId: context.direction?.beatId ?? null,
    });
    await recordBeatDraftedIfNeeded(context, script.id);

    if (scheduledDate) {
      await db.insert(calendarEntries).values({
        userId,
        scriptId: script.id,
        platform,
        scheduledDate: new Date(`${scheduledDate}T00:00:00.000Z`),
        contentCategoryId: context.contentCategory.id,
        seriesId: context.series?.id ?? null,
      });
    }

    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, scripts } from "@/db/schema";
import { generateScript } from "@/lib/llm/generateScript";
import { requireUserId } from "@/lib/auth/session";
import { buildGenerationContext, createScriptRecord } from "@/lib/services/scriptService";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { platformSchema, contentCategorySchema, contentTypeSchema, directiveSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { autoComposeDesign } from "@/lib/services/visualDesignService";
import { normalizeVisualSpec, visualFormatFieldsSchema } from "@/lib/visualDesign/visualFormat";

// contentCategoryId optional as soon as a series is provided — the series imposes its role
// (docs/SPEC_SERIES_ET_ROLES.md §4.2); mandatory for a free post (checked service-side).
const schema = z.object({
  platform: platformSchema,
  contentCategoryId: contentCategorySchema.optional(),
  contentType: contentTypeSchema,
  productId: z.uuid().optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD").optional(),
  seriesId: z.uuid().optional(),
  directive: directiveSchema,
  // Visual post format (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §2) — ignored outside "visual".
  ...visualFormatFieldsSchema.shape,
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
    // Each script generation costs an LLM call — limit shared with the other generation routes.
    await enforceRateLimit("script-generate", userId, 20, 60);
    const body = schema.parse(await request.json());
    const { platform, contentCategoryId, contentType, productId, scheduledDate, seriesId, directive } = body;
    await enforceScriptQuota(userId, { date: scheduledDate ? new Date(`${scheduledDate}T00:00:00.000Z`) : undefined });

    const context = await buildGenerationContext(
      userId,
      platform,
      contentCategoryId ?? null,
      contentType,
      productId,
      undefined,
      seriesId ?? null,
      undefined,
      directive,
      undefined,
      contentType === "visual" ? normalizeVisualSpec(body) : null
    );
    const generated = await generateScript(context);
    // resolvedProductId (not the raw productId): inherits the topic linked to the series when no topic
    // was chosen for this specific generation (docs/SPEC_REDACTEUR_EN_CHEF.md, topic selector).
    const script = await createScriptRecord(userId, platform, context.contentCategory, context.resolvedProductId ?? null, generated, {
      angleId: context.angle?.id ?? null,
      seriesId: context.series?.id ?? null,
      brandAssetId: context.brandAsset?.id ?? null,
      visual: context.visual,
    });
    // Mockup composed automatically in the background for a visual post
    // (docs/SPEC_COMPOSITION_VISUELLE.md §2) — never blocking, never counted in the quota.
    if (script.contentType === "visual") after(() => autoComposeDesign(userId, script.id));

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

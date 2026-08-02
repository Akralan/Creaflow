import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, scripts } from "@/db/schema";
import { generateScript } from "@/lib/llm/generateScript";
import { requireUserId } from "@/lib/auth/session";
import { buildGenerationContext, createScriptRecord } from "@/lib/services/scriptService";
import { platformSchema, contentCategorySchema, contentTypeSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({
  platform: platformSchema,
  contentCategoryId: contentCategorySchema,
  contentType: contentTypeSchema,
  productId: z.uuid().optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD").optional(),
  seriesId: z.uuid().optional(),
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
    const { platform, contentCategoryId, contentType, productId, scheduledDate, seriesId } = schema.parse(
      await request.json()
    );

    const context = await buildGenerationContext(
      userId,
      platform,
      contentCategoryId,
      contentType,
      productId,
      undefined,
      seriesId ?? null
    );
    const generated = await generateScript(context);
    const script = await createScriptRecord(userId, platform, context.contentCategory, productId ?? null, generated, {
      angleId: context.angle?.id ?? null,
      seriesId: context.series?.id ?? null,
    });

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

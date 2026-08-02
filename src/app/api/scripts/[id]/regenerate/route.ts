import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { generateScript } from "@/lib/llm/generateScript";
import type { Platform } from "@/lib/llm/prompts";
import { buildGenerationContext, updateScriptRecord } from "@/lib/services/scriptService";
import { ApiError, handleApiError } from "@/lib/api/errors";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const existing = await db.query.scripts.findFirst({
      where: and(eq(scripts.id, id), eq(scripts.userId, userId)),
    });
    if (!existing) {
      throw new ApiError(404, "Script introuvable.");
    }

    const context = await buildGenerationContext(
      userId,
      existing.platform as Platform,
      existing.contentCategoryId,
      existing.contentType,
      existing.productId,
      existing.id,
      existing.seriesId
    );
    const generated = await generateScript(context);
    const script = await updateScriptRecord(existing.id, context.contentCategory, generated, {
      angleId: context.angle?.id ?? null,
    });

    return NextResponse.json({ script });
  } catch (error) {
    return handleApiError(error);
  }
}

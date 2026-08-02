import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts, scriptStatusEnum } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";

const patchSchema = z.object({
  status: z.enum(scriptStatusEnum.enumValues),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const script = await db.query.scripts.findFirst({
      where: and(eq(scripts.id, id), eq(scripts.userId, userId)),
      with: { product: true, contentCategory: true, series: { columns: { id: true, label: true } }, metrics: true },
    });

    if (!script) {
      throw new ApiError(404, "Script introuvable.");
    }

    return NextResponse.json({ script });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { status } = patchSchema.parse(await request.json());

    const [script] = await db
      .update(scripts)
      .set({ status })
      .where(and(eq(scripts.id, id), eq(scripts.userId, userId)))
      .returning();

    if (!script) {
      throw new ApiError(404, "Script introuvable.");
    }

    return NextResponse.json({ script });
  } catch (error) {
    return handleApiError(error);
  }
}

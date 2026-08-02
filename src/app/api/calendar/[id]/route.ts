import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, calendarStatusEnum, contentCategories, contentSeries } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { contentCategorySchema } from "@/lib/validation";
import { ApiError, handleApiError } from "@/lib/api/errors";

const patchSchema = z
  .object({
    status: z.enum(calendarStatusEnum.enumValues).optional(),
    contentCategoryId: contentCategorySchema.optional(),
    seriesId: z.uuid().nullable().optional(),
  })
  .refine(
    (data) => data.status !== undefined || data.contentCategoryId !== undefined || data.seriesId !== undefined,
    { message: "Aucune modification fournie." }
  );

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { status, contentCategoryId, seriesId } = patchSchema.parse(await request.json());

    if (contentCategoryId) {
      const category = await db.query.contentCategories.findFirst({
        where: and(eq(contentCategories.id, contentCategoryId), eq(contentCategories.userId, userId)),
      });
      if (!category) {
        throw new ApiError(404, "Catégorie de contenu introuvable.");
      }
    }

    if (seriesId) {
      const series = await db.query.contentSeries.findFirst({
        where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)),
      });
      if (!series) {
        throw new ApiError(404, "Série introuvable.");
      }
    }

    const [entry] = await db
      .update(calendarEntries)
      .set({
        ...(status !== undefined && { status }),
        ...(contentCategoryId !== undefined && { contentCategoryId }),
        ...(seriesId !== undefined && { seriesId }),
      })
      .where(and(eq(calendarEntries.id, id), eq(calendarEntries.userId, userId)))
      .returning();

    if (!entry) {
      throw new ApiError(404, "Créneau calendrier introuvable.");
    }

    return NextResponse.json({ entry });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const existing = await db.query.calendarEntries.findFirst({
      where: and(eq(calendarEntries.id, id), eq(calendarEntries.userId, userId)),
    });
    if (!existing) {
      throw new ApiError(404, "Créneau calendrier introuvable.");
    }
    if (existing.scriptId) {
      throw new ApiError(409, "Ce créneau a déjà un script généré, impossible de le supprimer.");
    }

    await db.delete(calendarEntries).where(and(eq(calendarEntries.id, id), eq(calendarEntries.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

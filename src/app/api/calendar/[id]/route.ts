import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, calendarStatusEnum, contentCategories } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { contentCategorySchema } from "@/lib/validation";
import { resolveCategoryForGeneration } from "@/lib/services/seriesService";
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

// Lecture unitaire — nécessaire pour charger le brief d'un créneau AVANT qu'un Script n'existe
// (naissance paresseuse de l'éditeur, docs/SPEC_MATIERE_EDITEUR.md §4.5) ; seul GET /api/calendar?month=
// existait jusqu'ici (liste).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const entry = await db.query.calendarEntries.findFirst({
      where: and(eq(calendarEntries.id, id), eq(calendarEntries.userId, userId)),
      with: {
        script: { columns: { id: true, title: true, status: true } },
        contentCategory: { columns: { id: true, label: true, description: true } },
        series: { columns: { id: true, label: true } },
      },
    });

    if (!entry) {
      throw new ApiError(404, "Créneau calendrier introuvable.");
    }

    return NextResponse.json({ entry });
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
    const { status, contentCategoryId: requestedCategoryId, seriesId } = patchSchema.parse(await request.json());

    // Cohérence série↔rôle (docs/SPEC_SERIES_ET_ROLES.md §3) : quand une série est posée, c'est
    // elle qui impose le rôle ; en post libre (seriesId null ou inchangé sans série), le rôle
    // demandé doit exister. Un changement de rôle seul sur un créneau déjà en série est refusé —
    // il faut d'abord le passer en post libre.
    let contentCategoryId = requestedCategoryId;
    if (seriesId) {
      contentCategoryId = await resolveCategoryForGeneration(userId, { seriesId, contentCategoryId: requestedCategoryId });
    } else if (requestedCategoryId) {
      const category = await db.query.contentCategories.findFirst({
        where: and(eq(contentCategories.id, requestedCategoryId), eq(contentCategories.userId, userId)),
      });
      if (!category) {
        throw new ApiError(404, "Rôle introuvable.");
      }
      if (seriesId === undefined) {
        const existing = await db.query.calendarEntries.findFirst({
          where: and(eq(calendarEntries.id, id), eq(calendarEntries.userId, userId)),
          columns: { seriesId: true },
        });
        if (existing?.seriesId) {
          throw new ApiError(400, "Ce créneau appartient à une série : son rôle est celui de la série. Passe-le d'abord en post libre.");
        }
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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, calendarStatusEnum, contentCategories } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { contentCategorySchema } from "@/lib/validation";
import { resolveCategoryForGeneration } from "@/lib/services/seriesService";
import { skipSeriesSlot } from "@/lib/services/seriesSlotSync";
import { ApiError, handleApiError } from "@/lib/api/errors";

const patchSchema = z
  .object({
    status: z.enum(calendarStatusEnum.enumValues).optional(),
    contentCategoryId: contentCategorySchema.optional(),
    seriesId: z.uuid().nullable().optional(),
  })
  .refine(
    (data) => data.status !== undefined || data.contentCategoryId !== undefined || data.seriesId !== undefined,
    { message: "No changes provided." }
  );

// Single read — needed to load a slot's brief BEFORE a Script exists
// (lazy creation of the editor, docs/SPEC_MATIERE_EDITEUR.md §4.5); only GET /api/calendar?month=
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
      throw new ApiError(404, "Calendar slot not found.");
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

    // Series↔role consistency (docs/SPEC_SERIES_ET_ROLES.md §3): when a series is set, it
    // imposes the role; for a free post (seriesId null or unchanged without a series), the requested
    // role must exist. A role change alone on a slot already in a series is refused —
    // it must first be turned into a free post.
    let contentCategoryId = requestedCategoryId;
    if (seriesId) {
      contentCategoryId = await resolveCategoryForGeneration(userId, { seriesId, contentCategoryId: requestedCategoryId });
    } else if (requestedCategoryId) {
      const category = await db.query.contentCategories.findFirst({
        where: and(eq(contentCategories.id, requestedCategoryId), eq(contentCategories.userId, userId)),
      });
      if (!category) {
        throw new ApiError(404, "Role not found.");
      }
      if (seriesId === undefined) {
        const existing = await db.query.calendarEntries.findFirst({
          where: and(eq(calendarEntries.id, id), eq(calendarEntries.userId, userId)),
          columns: { seriesId: true },
        });
        if (existing?.seriesId) {
          throw new ApiError(400, "This slot belongs to a series: its role is the series' role. Switch it to a free post first.");
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
      throw new ApiError(404, "Calendar slot not found.");
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
      throw new ApiError(404, "Calendar slot not found.");
    }
    if (existing.scriptId) {
      throw new ApiError(409, "This slot already has a generated script and cannot be deleted.");
    }

    // Slot belonging to a series: recorded as skipped, otherwise the rhythm would recreate it on the next recompute
    // (docs/SPEC_RYTHME_DES_SERIES.md §3).
    if (existing.seriesId) {
      await skipSeriesSlot(userId, { id: existing.id, seriesId: existing.seriesId, platform: existing.platform, scheduledDate: existing.scheduledDate });
    } else {
      await db.delete(calendarEntries).where(and(eq(calendarEntries.id, id), eq(calendarEntries.userId, userId)));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, calendarStatusEnum } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";

const patchSchema = z.object({
  status: z.enum(calendarStatusEnum.enumValues),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { status } = patchSchema.parse(await request.json());

    const [entry] = await db
      .update(calendarEntries)
      .set({ status })
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

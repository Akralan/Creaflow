import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { generateScript } from "@/lib/claude/generateScript";
import { buildGenerationContext, createScriptRecord } from "@/lib/services/scriptService";
import { ApiError, handleApiError } from "@/lib/api/errors";

const schema = z.object({ calendarEntryId: z.uuid() });

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { calendarEntryId } = schema.parse(await request.json());

    const entry = await db.query.calendarEntries.findFirst({
      where: and(eq(calendarEntries.id, calendarEntryId), eq(calendarEntries.userId, userId)),
    });
    if (!entry) {
      throw new ApiError(404, "Créneau calendrier introuvable.");
    }
    if (entry.scriptId) {
      throw new ApiError(409, "Ce créneau a déjà un script associé.");
    }

    const context = await buildGenerationContext(userId, entry.platform, entry.contentCategory);
    const generated = await generateScript(context);
    const script = await createScriptRecord(userId, entry.platform, entry.contentCategory, null, generated);

    await db.update(calendarEntries).set({ scriptId: script.id }).where(eq(calendarEntries.id, entry.id));

    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

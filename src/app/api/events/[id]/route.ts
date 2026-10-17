import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { deleteEventForUser, updateEventForUser } from "@/lib/services/materialEventService";
import { DATE_PRECISIONS, EVENT_KINDS } from "@/lib/llm/eventReader";
import { handleApiError } from "@/lib/api/errors";

const patchSchema = z.object({
  date: z.string().trim().optional(),
  datePrecision: z.enum(DATE_PRECISIONS).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  whatHappened: z.string().trim().min(1).max(1500).optional(),
  whatChanged: z.string().trim().max(1000).nullable().optional(),
  kind: z.enum(EVENT_KINDS).optional(),
  audiences: z.array(z.string().trim().min(1)).max(5).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const patch = patchSchema.parse(await request.json());
    const event = await updateEventForUser(userId, id, patch);
    return NextResponse.json({ event });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteEventForUser(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { deleteInspiration, setInspirationStatus } from "@/lib/services/inspirationService";

const schema = z.object({ status: z.enum(["active", "dismissed"]) });

/** Dismiss or restore an inspiration card (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.4). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { status } = schema.parse(await request.json());
    return NextResponse.json({ inspiration: await setInspirationStatus(userId, id, status) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteInspiration(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { discardAttachment } from "@/lib/services/assistantService";
import { handleApiError } from "@/lib/api/errors";

/** Removes a file that was dropped but not yet filed as material — the "actually, not that one" gesture.
 *  A file already filed has become a SourceMaterial: it is deleted from the Material space. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await discardAttachment(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

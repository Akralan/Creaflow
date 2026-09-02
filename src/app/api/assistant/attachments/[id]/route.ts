import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { discardAttachment } from "@/lib/services/assistantService";
import { handleApiError } from "@/lib/api/errors";

/** Retire un fichier déposé mais pas encore rangé en matière — le geste « en fait, pas celui-là ».
 *  Un fichier déjà rangé est devenu un SourceMaterial : il se supprime depuis l'espace Matière. */
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

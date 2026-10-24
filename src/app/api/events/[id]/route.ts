import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { deleteEventForUser } from "@/lib/services/materialEventService";
import { handleApiError } from "@/lib/api/errors";

/**
 * Supprimer un pointeur. Le PATCH a été retiré avec le chantier : un pointeur n'a plus de champ à
 * corriger (docs/SPEC_EVENEMENT_POINTEUR.md §2). Supprimer n'efface rien du document — la
 * relecture de la matière le reproduira.
 */
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

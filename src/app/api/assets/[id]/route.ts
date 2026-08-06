import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { archiveAssetForUser } from "@/lib/services/brandAssetService";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    // Soft delete : les objets R2 ne sont pas supprimés, des scripts déjà générés peuvent encore
    // référencer cet asset.
    await archiveAssetForUser(userId, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

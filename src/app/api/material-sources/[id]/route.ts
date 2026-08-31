import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { deleteSource } from "@/lib/services/githubSourceService";
import { handleApiError } from "@/lib/api/errors";

/** Supprime la source ET ses documents miroir (cascade). La confirmation est portée par l'UI, qui
 *  annonce ce qui va disparaître avant d'appeler. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteSource(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

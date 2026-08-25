import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { deleteMaterialForUser } from "@/lib/services/sourceMaterialService";
import { handleApiError } from "@/lib/api/errors";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteMaterialForUser(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

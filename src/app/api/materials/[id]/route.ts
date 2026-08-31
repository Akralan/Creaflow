import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { deleteMaterialForUser, updateMaterialSummary } from "@/lib/services/sourceMaterialService";
import { handleApiError } from "@/lib/api/errors";

// Édition manuelle du résumé (docs/SPEC_REDACTEUR_EN_CHEF.md §6/§7) — null = remise à zéro
// volontaire (redevient éligible au backfill paresseux), sinon même plafond que le résumeur (§5).
const patchSchema = z.object({ summary: z.string().trim().min(1).max(300).nullable() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { summary } = patchSchema.parse(await request.json());
    const material = await updateMaterialSummary(userId, id, summary);
    return NextResponse.json({ material });
  } catch (error) {
    return handleApiError(error);
  }
}

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

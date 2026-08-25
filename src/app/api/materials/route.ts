import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { createPastedMaterial, listMaterialsForSubject } from "@/lib/services/sourceMaterialService";
import { handleApiError } from "@/lib/api/errors";

const listSchema = z.object({ productId: z.uuid().optional() });

const createSchema = z.object({
  productId: z.uuid().optional(),
  title: z.string().optional(),
  rawText: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId } = listSchema.parse({ productId: request.nextUrl.searchParams.get("productId") ?? undefined });
    const materials = await listMaterialsForSubject(userId, productId ?? null);
    return NextResponse.json({ materials });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId, title, rawText } = createSchema.parse(await request.json());
    // Dépôt gratuit, immédiatement utilisable — aucun traitement asynchrone (docs/SPEC_MATIERE_EDITEUR.md §3).
    const material = await createPastedMaterial(userId, { productId: productId ?? null, title, rawText });
    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

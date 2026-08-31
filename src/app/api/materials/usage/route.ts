import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { findDocumentUsage } from "@/lib/services/narrativeDirector";
import { handleApiError } from "@/lib/api/errors";

// Espace matière (maquette 1c) — où chaque document est consommé dans les plans, pour afficher
// « Déjà exploité · Ép. N ». Lecture seule : contrairement à /api/narrative/ensure, cet endpoint ne
// crée jamais d'état narratif, un simple affichage ne devant pas produire d'effet de bord.
const schema = z.object({ productId: z.uuid() });

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId } = schema.parse({ productId: request.nextUrl.searchParams.get("productId") ?? undefined });
    const usage = await findDocumentUsage(userId, productId);
    return NextResponse.json({ usage: Object.fromEntries(usage) });
  } catch (error) {
    return handleApiError(error);
  }
}

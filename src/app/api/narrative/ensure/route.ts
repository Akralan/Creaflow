import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { ensureNarrativeState } from "@/lib/services/narrativeDirector";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({ productId: z.uuid().optional(), seriesId: z.uuid().optional() });

/**
 * Trouve ou crée une ligne NarrativeState vide, sans planification (docs/SPEC_REDACTEUR_EN_CHEF.md
 * §5/§7, Lot B4). Nécessaire pour le mode rendez_vous : `POST /api/narrative/plan` refuse (409) ce
 * mode explicitement, mais l'état doit quand même pouvoir exister pour porter formatContract/
 * callbacks/openPromises édités à la main — jamais un endpoint de planification, juste une porte
 * d'existence, appelée par l'écran Direction avant une première édition sur une série rendez_vous.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId, seriesId } = schema.parse(await request.json());
    const state = await ensureNarrativeState(userId, { productId, seriesId });
    return NextResponse.json({ state });
  } catch (error) {
    return handleApiError(error);
  }
}

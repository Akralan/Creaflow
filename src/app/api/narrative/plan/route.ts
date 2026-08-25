import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { planNarrativeForSubject } from "@/lib/services/narrativeDirector";
import { directiveSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({
  productId: z.uuid().optional(),
  seriesId: z.uuid().optional(),
  directive: directiveSchema,
});

/**
 * Bouton "Planifier la suite"/"Replanifier" de l'écran Direction (docs/SPEC_REDACTEUR_EN_CHEF.md §6).
 * Crée l'état narratif du sujet paresseusement s'il n'existe pas, backfill les résumés manquants,
 * puis appelle la planification glissante. 409 si la cible est une série en mode rendez_vous.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Même famille que series-generate/style-analysis : action utilisateur explicite déclenchant un
    // ou plusieurs appels LLM en cascade (backfill + planification) — distinct des appels système du
    // chef (résumeur à l'ingestion), jamais rate-limités eux (§1).
    await enforceRateLimit("narrative-plan", userId, 5, 60);
    const { productId, seriesId, directive } = schema.parse(await request.json().catch(() => ({})));
    const state = await planNarrativeForSubject(userId, { productId, seriesId, directive });
    return NextResponse.json({ state });
  } catch (error) {
    return handleApiError(error);
  }
}

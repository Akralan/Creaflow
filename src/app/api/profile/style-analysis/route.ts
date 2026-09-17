import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { getStyleLearningStatus, runStyleLearningPass } from "@/lib/services/styleLearningService";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const schema = z.object({
  // true = rejoue aussi les scripts déjà appris (reconstruction manuelle du profil).
  includeLearned: z.boolean().optional(),
});

/**
 * Passe d'apprentissage du style (docs/SPEC_APPRENTISSAGE_STYLE.md §5.3). Crée une proposition à
 * valider, sauf s'il n'y avait aucun profil (écriture directe). Renvoie le profil courant et l'état
 * du compteur pour que l'écran se mette à jour sans second appel.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Analyse coûteuse (un appel LLM sur jusqu'à 20 scripts) — limite basse.
    await enforceRateLimit("style-analysis", userId, 5, 60);
    const text = await request.text();
    const body = schema.parse(text ? JSON.parse(text) : {});
    const result = await runStyleLearningPass(userId, { includeLearned: body.includeLearned });
    const profile = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.userId, userId),
    });
    const styleLearning = await getStyleLearningStatus(userId);
    return NextResponse.json({
      profile,
      styleLearning,
      proposalId: result.proposalId,
      changeNotes: result.changeNotes,
      proposedStyleProfile: result.styleProfile,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse, after } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { completeOnboarding, completeOnboardingSchema } from "@/lib/services/onboardingService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";
import { refreshStaleReaderPortraits } from "@/lib/services/readerPortraitService";
import { logger } from "@/lib/logger";

/** Fin de l'onboarding : sujets regroupés, profil, rythme, puis rôles/angles/séries (appels LLM). */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("onboarding-complete", userId, 10, 60 * 60);
    await completeOnboarding(userId, completeOnboardingSchema.parse(await request.json()));
    // Portrait des lecteurs de chaque sujet, hors requête (docs/SPEC_PROMPT_GENERATION_V3.md §2.2).
    after(() =>
      refreshStaleReaderPortraits(userId).catch((err) => logger.error("Portraits des lecteurs échoués", err, { userId }))
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

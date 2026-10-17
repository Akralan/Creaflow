import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { completeOnboarding, completeOnboardingSchema } from "@/lib/services/onboardingService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

/** Fin de l'onboarding : sujets regroupés, profil, rythme, puis rôles/angles/séries (appels LLM). */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("onboarding-complete", userId, 10, 60 * 60);
    // Le portrait des lecteurs est produit dedans, avant les séries, en synchrone
    // (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4) — plus en tâche de fond.
    await completeOnboarding(userId, completeOnboardingSchema.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

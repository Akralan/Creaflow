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
    await completeOnboarding(userId, completeOnboardingSchema.parse(await request.json()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

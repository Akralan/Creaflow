import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/session";
import { getOnboardingState } from "@/lib/services/onboardingService";
import { handleApiError } from "@/lib/api/errors";

/** Ouverte sans session : l'écran 1 de l'onboarding est aussi la page d'inscription
 *  (docs/SPEC_ONBOARDING_MVP.md §2) — sans compte, il n'y a simplement rien à restituer. */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ signedIn: false });
    return NextResponse.json({ signedIn: true, ...(await getOnboardingState(userId)) });
  } catch (error) {
    return handleApiError(error);
  }
}

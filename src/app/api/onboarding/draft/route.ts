import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { draftOnboardingProfile } from "@/lib/services/onboardingService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({ name: z.string().trim().max(200).default("") });

/** Écran 3 de l'onboarding : un appel LLM sur la matière branchée, rien n'est écrit. */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("onboarding-draft", userId, 10, 60 * 60);
    const { name } = schema.parse(await request.json());
    return NextResponse.json({ draft: await draftOnboardingProfile(userId, name) });
  } catch (error) {
    return handleApiError(error);
  }
}

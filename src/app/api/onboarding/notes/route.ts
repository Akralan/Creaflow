import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { addOnboardingNotes } from "@/lib/services/onboardingService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({ text: z.string().trim().min(1, "Paste your notes first.").max(100_000) });

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("onboarding-notes", userId, 30, 60 * 60);
    const { text } = schema.parse(await request.json());
    return NextResponse.json({ note: await addOnboardingNotes(userId, text) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

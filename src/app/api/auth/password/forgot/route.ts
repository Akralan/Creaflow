import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit, getClientIp, pseudonymizeIdentifier } from "@/lib/services/rateLimitService";
import { requestPasswordReset } from "@/lib/services/passwordService";

const schema = z.object({ email: z.email() });

// Répond toujours pareil, que l'adresse soit connue ou non (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.3).
// Double limite comme sur /login : l'IP contre le spam, l'email contre le harcèlement d'un compte.
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip) {
      await enforceRateLimit("password-forgot-ip", ip, 5, 60 * 60);
    }
    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase();
    await enforceRateLimit("password-forgot-email", pseudonymizeIdentifier(email), 3, 60 * 60);

    await requestPasswordReset(email);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

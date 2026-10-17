import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/errors";
import { setSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit, getClientIp } from "@/lib/services/rateLimitService";
import { resetPasswordWithToken } from "@/lib/services/passwordService";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

// Le jeton vaut preuve de possession de l'adresse : on connecte l'utilisateur dans la foulée.
// Le cookie posé ici est émis après `sessionsInvalidatedBefore`, donc il reste valide.
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip) {
      await enforceRateLimit("password-reset-ip", ip, 10, 60 * 60);
    }
    const body = schema.parse(await request.json());

    const { userId } = await resetPasswordWithToken(body.token, body.password);
    await setSessionCookie(userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

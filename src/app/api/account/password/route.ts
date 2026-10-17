import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/errors";
import { requireUserId, setSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { changePassword } from "@/lib/services/passwordService";

const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters long."),
});

// Change (or setting, for an account without a password) from the Account tab. The change
// closes all sessions, including this one: we set the cookie again right away so that the user
// stays signed in on the tab they acted from.
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("account-password", userId, 5, 60 * 60);
    const body = schema.parse(await request.json());

    await changePassword(userId, body.currentPassword, body.newPassword);
    await setSessionCookie(userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

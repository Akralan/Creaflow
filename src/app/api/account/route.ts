import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/errors";
import { clearSessionCookie, requireUserId } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { assertDeletionConfirmed, deleteAccount, getAccountSummary } from "@/lib/services/accountService";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({ account: await getAccountSummary(userId) });
  } catch (error) {
    return handleApiError(error);
  }
}

const deleteSchema = z.object({
  password: z.string().optional(),
  emailConfirmation: z.string().optional(),
});

// Suppression de compte (docs/SPEC_LEGAL_EMAIL_RGPD.md §4.2) : confirmation par mot de passe, ou
// par recopie de l'adresse pour un compte sans mot de passe. Le cookie est effacé ensuite — et de
// toute façon getCurrentUserId ne reconnaîtrait plus un utilisateur qui n'existe plus.
export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("account-delete", userId, 3, 60 * 60);
    const body = deleteSchema.parse(await request.json().catch(() => ({})));

    await assertDeletionConfirmed(userId, body);
    await deleteAccount(userId);
    await clearSessionCookie();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/errors";
import { requireUserId, setSessionCookie } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { changePassword } from "@/lib/services/passwordService";

const schema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
});

// Changement (ou définition, pour un compte sans mot de passe) depuis l'onglet Compte. Le
// changement ferme toutes les sessions, y compris celle-ci : on repose le cookie dans la foulée
// pour que l'utilisateur reste connecté sur l'onglet d'où il a agi.
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

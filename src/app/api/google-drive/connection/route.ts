import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getGoogleDriveConnectionForUser,
} from "@/lib/services/googleDriveService";

const connectSchema = z.object({ code: z.string().min(1) });

export async function GET() {
  try {
    const userId = await requireUserId();
    const connection = await getGoogleDriveConnectionForUser(userId);
    return NextResponse.json({
      connected: !!connection,
      status: connection?.status ?? null,
      driveAccountEmail: connection?.driveAccountEmail ?? null,
      connectedAt: connection?.connectedAt ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { code } = connectSchema.parse(await request.json());
    // L'access token est renvoyé uniquement pour initialiser le widget Google Picker côté
    // navigateur — jamais journalisé, jamais persisté côté client au-delà de cet usage immédiat.
    const { accessToken } = await connectGoogleDrive(userId, code);
    return NextResponse.json({ accessToken, status: "ok" });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const userId = await requireUserId();
    // Déconnexion locale uniquement — ne révoque pas l'accès côté Google (limite acceptée en v1).
    await disconnectGoogleDrive(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { listPendingProposals } from "@/lib/services/assistantService";

/** Propositions en attente, hors écran /assistant — Paramètres affiche celle du style
 *  (docs/SPEC_APPRENTISSAGE_STYLE.md §6.1). */
export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({ proposals: await listPendingProposals(userId) });
  } catch (error) {
    return handleApiError(error);
  }
}

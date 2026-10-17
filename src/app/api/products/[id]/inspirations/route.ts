import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { listInspirations, runInspirationResearch } from "@/lib/services/inspirationService";

/** Fiches d'inspiration du sujet, actives puis écartées (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.4). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await listInspirations(userId, id));
  } catch (error) {
    return handleApiError(error);
  }
}

/** « Lancer une veille » : recherche web puis mise en fiches, en direct (l'auteur attend le résultat). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("inspiration-research", userId, 10, 60 * 60);
    const { id } = await params;
    return NextResponse.json(await runInspirationResearch(userId, id));
  } catch (error) {
    return handleApiError(error);
  }
}

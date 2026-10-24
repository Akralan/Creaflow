import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { sourceReadingStatus } from "@/lib/services/materialEventService";
import { handleApiError } from "@/lib/api/errors";

/** Où en est la lecture d'une source : documents, non lus, événements trouvés. Sondé par le panneau
 *  de Business context pendant l'ingestion (docs/SPEC_RATTACHEMENT_SOURCES.md). Léger exprès :
 *  `GET /api/events` rend tous les pointeurs du sujet, trop pour un sondage toutes les 3 s. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await sourceReadingStatus(userId, id));
  } catch (error) {
    return handleApiError(error);
  }
}

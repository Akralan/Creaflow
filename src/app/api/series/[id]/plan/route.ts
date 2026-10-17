import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { planForSeries } from "@/lib/services/seriesReaderService";
import { handleApiError } from "@/lib/api/errors";

/** Le plan de la série : la ligne de temps du sujet vue par son lecteur (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json({ plan: await planForSeries(userId, id) });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { saveSeriesForm, seriesFormEditSchema } from "@/lib/services/seriesReaderService";
import { handleApiError } from "@/lib/api/errors";

/** Correction à la main de la forme de la série (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const series = await saveSeriesForm(userId, id, seriesFormEditSchema.parse(await request.json()));
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

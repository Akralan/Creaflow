import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { saveFraming, saveFramingSchema } from "@/lib/services/seriesFramingService";

/** Enregistre le cadrage choisi pour la série (docs/SPEC_CADRAGE_SERIE.md §2). */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const series = await saveFraming(userId, id, saveFramingSchema.parse(await request.json()));
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

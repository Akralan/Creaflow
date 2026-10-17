import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { updateSeriesFields } from "@/lib/services/seriesService";
import { handleApiError } from "@/lib/api/errors";

// Changement du sujet lié depuis une carte de la bibliothèque — POST /api/series traite tout le
// tableau des séries actives comme un diff complet (archive ce qui est omis), inadapté à l'édition
// d'un champ.
const patchSchema = z.object({ productId: z.uuid().nullable() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { productId } = patchSchema.parse(await request.json());
    const series = await updateSeriesFields(userId, id, { productId });
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

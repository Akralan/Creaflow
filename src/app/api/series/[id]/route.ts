import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { updateSeriesFields } from "@/lib/services/seriesService";
import { contentSeriesModeSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";

// Endpoint dédié à la bascule de mode et au sujet lié (docs/SPEC_REDACTEUR_EN_CHEF.md §7) —
// POST /api/series traite tout le tableau des séries actives comme un diff complet (archive ce qui
// est omis), inadapté à l'édition d'un ou deux champs depuis une carte de la bibliothèque.
const patchSchema = z
  .object({ mode: contentSeriesModeSchema.optional(), productId: z.uuid().nullable().optional() })
  .refine((data) => data.mode !== undefined || data.productId !== undefined, {
    message: "Aucune modification fournie.",
  });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { mode, productId } = patchSchema.parse(await request.json());
    const series = await updateSeriesFields(userId, id, { mode, productId });
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

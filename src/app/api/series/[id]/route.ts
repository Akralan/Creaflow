import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { updateSeriesMode } from "@/lib/services/seriesService";
import { contentSeriesModeSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";

// Endpoint dédié à la bascule de mode (docs/SPEC_REDACTEUR_EN_CHEF.md §7) — POST /api/series traite
// tout le tableau des séries actives comme un diff complet (archive ce qui est omis), inadapté à
// l'édition d'un seul champ depuis une carte de la bibliothèque.
const patchSchema = z.object({ mode: contentSeriesModeSchema });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { mode } = patchSchema.parse(await request.json());
    const series = await updateSeriesMode(userId, id, mode);
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

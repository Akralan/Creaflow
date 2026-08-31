import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { generateSeriesFromMaterial } from "@/lib/services/seriesFromMaterialService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

// docs/SPEC_REDACTEUR_EN_CHEF.md §4.4 — platform/contentCategoryId/contentType/episodeCount ont
// disparu avec le mécanisme one-shot qu'ils servaient (générer N scripts complets synchrones) : la
// planification glissante qui le remplace ne les utilise pas, la génération réelle suit le flux
// normal (créneau/libre) ensuite.
const schema = z
  .object({
    productId: z.uuid().optional(),
    seriesId: z.uuid().optional(),
    newSeries: z
      .object({
        label: z.string().min(1),
        description: z.string().min(1),
        // Rôle unique de la série créée (docs/SPEC_SERIES_ET_ROLES.md §1).
        categoryId: z.uuid(),
        weight: z.number().int().min(1).max(100).optional(),
      })
      .optional(),
  })
  .refine((data) => !!data.seriesId !== !!data.newSeries, {
    message: "Précise soit seriesId, soit newSeries — pas les deux, pas aucun.",
  });

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Backfill des résumés + planification — même famille que narrative-plan (bouton explicite,
    // appels LLM en cascade).
    await enforceRateLimit("narrative-plan", userId, 5, 60);
    const body = schema.parse(await request.json());
    const result = await generateSeriesFromMaterial(userId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

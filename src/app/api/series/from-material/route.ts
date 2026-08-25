import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { generateSeriesFromMaterial } from "@/lib/services/seriesFromMaterialService";
import { platformSchema, contentCategorySchema, contentTypeSchema } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const schema = z
  .object({
    productId: z.uuid().optional(),
    seriesId: z.uuid().optional(),
    newSeries: z.object({ label: z.string().min(1), description: z.string().min(1), weight: z.number().int().min(1).max(100).optional() }).optional(),
    platform: platformSchema,
    contentCategoryId: contentCategorySchema,
    contentType: contentTypeSchema,
    episodeCount: z.number().int().min(2).max(10).default(5),
  })
  .refine((data) => !!data.seriesId !== !!data.newSeries, {
    message: "Précise soit seriesId, soit newSeries — pas les deux, pas aucun.",
  });

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Génère N scripts complets — partage la limite de "script-generate" (même coût par génération).
    await enforceRateLimit("script-generate", userId, 20, 60);
    const body = schema.parse(await request.json());
    const result = await generateSeriesFromMaterial(userId, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

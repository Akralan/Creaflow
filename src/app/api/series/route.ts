import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { generateSeriesForUser, listActiveSeriesForUser, saveSeriesForUser } from "@/lib/services/seriesService";
import { platformSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const saveSchema = z.object({
  series: z.array(
    z.object({
      id: z.uuid().optional(),
      label: z.string().min(1),
      description: z.string().min(1),
      weight: z.number().int().min(0).max(100),
      categoryIds: z.array(z.uuid()).min(1),
      platforms: z.array(platformSchema).default([]),
    })
  ),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const series = await listActiveSeriesForUser(userId);
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();

    const rawBody = await request.text();
    if (rawBody) {
      // Édition manuelle : on valide sans repasser par l'IA.
      const { series: items } = saveSchema.parse(JSON.parse(rawBody));
      const series = await saveSeriesForUser(userId, items);
      return NextResponse.json({ series });
    }

    // Régénération complète des séries via l'IA (contrairement à l'édition manuelle ci-dessus) —
    // même ordre de grandeur que style-analysis pour une action de ce type.
    await enforceRateLimit("series-generate", userId, 5, 60);
    const series = await generateSeriesForUser(userId);
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

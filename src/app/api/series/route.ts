import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { generateSeriesForUser, listActiveSeriesForUser, saveSeriesForUser } from "@/lib/services/seriesService";
import { platformSchema } from "@/lib/validation";
import { seriesRhythmSchema } from "@/lib/seriesRhythm";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const saveSchema = z.object({
  series: z.array(
    z.object({
      id: z.uuid().optional(),
      label: z.string().min(1),
      description: z.string().min(1),
      // Display order only since docs/SPEC_RYTHME_DES_SERIES.md.
      weight: z.number().int().min(0).max(100).optional(),
      // One unique role per series (docs/SPEC_SERIES_ET_ROLES.md §1).
      categoryId: z.uuid(),
      platforms: z.array(platformSchema).default([]),
      rhythm: seriesRhythmSchema.nullable().optional(),
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
      // Manual edit: we validate without going through the AI again.
      const { series: items } = saveSchema.parse(JSON.parse(rawBody));
      const { series, slotChanges } = await saveSeriesForUser(userId, items);
      return NextResponse.json({ series, slotChanges });
    }

    // Full regeneration of the series via AI (unlike the manual edit above) —
    // same order of magnitude as style-analysis for an action of this kind.
    await enforceRateLimit("series-generate", userId, 5, 60);
    const series = await generateSeriesForUser(userId);
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

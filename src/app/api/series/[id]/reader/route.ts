import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { readersForSeries, setSeriesReader } from "@/lib/services/seriesReaderService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({ readerLabel: z.string().trim().min(1).max(60) });

/** The possible audiences of the series (its topic's portrait). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json({ readers: await readersForSeries(userId, id) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Choice of the series reader (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4): the only thing a series tells the writer. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("series-reader", userId, 20, 60 * 60);
    const { id } = await params;
    const { readerLabel } = schema.parse(await request.json());
    const series = await setSeriesReader(userId, id, readerLabel);
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

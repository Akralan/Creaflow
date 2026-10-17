import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { updateSeriesFields } from "@/lib/services/seriesService";
import { handleApiError } from "@/lib/api/errors";

// Change of the linked topic from a library card — POST /api/series treats the whole
// array of active series as a full diff (archives what is omitted), unsuited to editing
// a single field.
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

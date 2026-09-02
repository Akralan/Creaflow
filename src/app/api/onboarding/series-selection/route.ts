import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { keepOnlySeries } from "@/lib/services/seriesService";
import { handleApiError } from "@/lib/api/errors";

/** Fin d'onboarding : l'utilisateur a vu les séries générées et coché celles qu'il garde.
 *  Au moins une — une direction éditoriale vide rendrait le calendrier inopérant. */
const schema = z.object({ keptIds: z.array(z.string().uuid()).min(1) });

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { keptIds } = schema.parse(await request.json());
    const series = await keepOnlySeries(userId, keptIds);
    return NextResponse.json({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

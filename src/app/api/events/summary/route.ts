import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { eventSummaryForSubject } from "@/lib/services/materialEventService";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({ productId: z.uuid() });

/** Le nombre d'événements d'un projet par genre, pour la modale « Understand it » de Business context
 *  (docs/SPEC_COMPRENDRE_LE_PROJET.md). Pas la ligne de temps : des comptes seulement. */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId } = schema.parse({ productId: request.nextUrl.searchParams.get("productId") ?? undefined });
    return NextResponse.json(await eventSummaryForSubject(userId, productId));
  } catch (error) {
    return handleApiError(error);
  }
}

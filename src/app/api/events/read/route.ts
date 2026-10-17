import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { readEventsForSubject } from "@/lib/services/materialEventService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const schema = z.object({ productId: z.uuid() });

/**
 * Bouton « Relire la matière » (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3) : lit les documents du sujet
 * pas encore lus et enregistre leurs événements. Synchrone : la réponse arrive quand la lecture est
 * finie, avec son rapport. Plusieurs minutes possibles sur un gros sujet.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("events-read", userId, 5, 60);
    const { productId } = schema.parse(await request.json());
    const report = await readEventsForSubject(userId, productId);
    return NextResponse.json({ report });
  } catch (error) {
    return handleApiError(error);
  }
}

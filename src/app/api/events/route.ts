import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { countUnreadDocuments, listEventsForSubject } from "@/lib/services/materialEventService";
import { handleApiError } from "@/lib/api/errors";

const listSchema = z.object({ productId: z.uuid() });

/**
 * La ligne de temps d'un sujet : des pointeurs (docs/SPEC_EVENEMENT_POINTEUR.md §2).
 *
 * Le POST a été retiré avec le chantier : un pointeur est une adresse dans un document, produite
 * par la lecture. Il ne se saisit pas à la main — l'auteur ajoute de la matière, pas des adresses.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId } = listSchema.parse({ productId: request.nextUrl.searchParams.get("productId") ?? undefined });
    const [events, unreadDocuments] = await Promise.all([
      listEventsForSubject(userId, productId),
      countUnreadDocuments(userId, productId),
    ]);
    return NextResponse.json({ events, unreadDocuments });
  } catch (error) {
    return handleApiError(error);
  }
}

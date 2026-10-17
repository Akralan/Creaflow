import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { MIN_PRODUCTS } from "@/lib/validation";
import { updateProductForUser } from "@/lib/services/productsService";
import { refreshStaleReaderPortraits } from "@/lib/services/readerPortraitService";
import { logger } from "@/lib/logger";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  valueProposition: z.string().optional(),
  photoUrl: z.string().optional(),
  // Override d'audience par sujet, nullable explicitement pour permettre de revenir au fallback
  // marque (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — seul champ de ce schéma qui accepte null,
  // les autres restent "omis = inchangé" par cohérence avec le reste du formulaire produit.
  targetAudience: z.string().nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = updateProductSchema.parse(await request.json());

    const updated = await updateProductForUser(userId, id, body);
    // Un « Pour qui » modifié périme le portrait (sauf s'il a été corrigé à la main).
    if (body.targetAudience !== undefined) {
      after(() =>
        refreshStaleReaderPortraits(userId, [id]).catch((err) => logger.error("Portraits des lecteurs échoués", err, { userId }))
      );
    }

    return NextResponse.json({ product: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(products)
      .where(eq(products.userId, userId));

    // On ne bloque que la sortie du seuil (3 -> 2), pas la construction progressive
    // du catalogue en dessous de 3 pendant l'onboarding.
    if (existingCount === MIN_PRODUCTS) {
      throw new ApiError(
        400,
        `Le catalogue doit contenir au moins ${MIN_PRODUCTS} produits.`
      );
    }

    const [deleted] = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning({ id: products.id });

    if (!deleted) {
      throw new ApiError(404, "Produit introuvable.");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

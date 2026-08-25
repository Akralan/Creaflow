import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { createPastedMaterial, listMaterialsForSubject, summarizeMaterialDocument } from "@/lib/services/sourceMaterialService";
import { markStaleForMaterialIngestion } from "@/lib/services/narrativeDirector";
import { handleApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

const listSchema = z.object({ productId: z.uuid().optional() });

const createSchema = z.object({
  productId: z.uuid().optional(),
  title: z.string().optional(),
  rawText: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId } = listSchema.parse({ productId: request.nextUrl.searchParams.get("productId") ?? undefined });
    const materials = await listMaterialsForSubject(userId, productId ?? null);
    // Le backfill paresseux (docs/SPEC_REDACTEUR_EN_CHEF.md §3.1) est déclenché depuis
    // POST /api/narrative/plan (narrativeDirector.ts) depuis le Lot B2, plus ici — c'est le
    // déclencheur natif de la spec (bouton "Planifier la suite"). Le trigger intermédiaire posé au
    // Lot B1 (avant que la planification existe) a été retiré.
    return NextResponse.json({ materials });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId, title, rawText } = createSchema.parse(await request.json());
    // Dépôt gratuit, immédiatement utilisable — aucun traitement asynchrone (docs/SPEC_MATIERE_EDITEUR.md §3).
    const material = await createPastedMaterial(userId, { productId: productId ?? null, title, rawText });
    // Ingestion de matière (§5, Lot B4) : marque isStale l'état du sujet + des séries liées — écriture
    // DB simple, pas un appel LLM, pas la peine de la différer via after().
    await markStaleForMaterialIngestion(userId, productId ?? null);
    after(() =>
      summarizeMaterialDocument(material.id).catch((err) =>
        logger.error("Résumé de matière échoué", err, { materialId: material.id })
      )
    );
    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

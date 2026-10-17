import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { createFileMaterial, summarizeMaterialDocument } from "@/lib/services/sourceMaterialService";
import { scheduleEventReading } from "@/lib/services/materialEventService";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

const MAX_MATERIAL_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo — texte brut, largement suffisant

// V1 anti-scope (docs/SPEC_MATIERE_EDITEUR.md §3.2) : coller du texte + fichiers md/txt, point.
// Pas de parseur PDF, pas de visionneuse — ne pas construire un "gestionnaire de documents IA" par accident.
const ALLOWED_EXTENSIONS = [".md", ".txt"];

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const formData = await request.formData();
    const productId = formData.get("productId");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "No file provided.");
    }
    if (!ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      throw new ApiError(400, "Only .md and .txt files are accepted.");
    }
    if (file.size > MAX_MATERIAL_FILE_SIZE_BYTES) {
      throw new ApiError(400, "File too large (2 MB max).");
    }

    const rawText = await file.text();
    const resolvedProductId = typeof productId === "string" && productId ? productId : null;
    const material = await createFileMaterial(userId, {
      productId: resolvedProductId,
      title: file.name,
      rawText,
    });
    after(() =>
      summarizeMaterialDocument(material.id).catch((err) =>
        logger.error("Material summary failed", err, { materialId: material.id })
      )
    );
    // Lecture des événements du sujet en arrière-plan (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3).
    scheduleEventReading(userId, resolvedProductId);

    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { createFileMaterial, summarizeMaterialDocument } from "@/lib/services/sourceMaterialService";
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
      throw new ApiError(400, "Aucun fichier fourni.");
    }
    if (!ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      throw new ApiError(400, "Seuls les fichiers .md et .txt sont acceptés.");
    }
    if (file.size > MAX_MATERIAL_FILE_SIZE_BYTES) {
      throw new ApiError(400, "Fichier trop volumineux (2 Mo maximum).");
    }

    const rawText = await file.text();
    const material = await createFileMaterial(userId, {
      productId: typeof productId === "string" && productId ? productId : null,
      title: file.name,
      rawText,
    });
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

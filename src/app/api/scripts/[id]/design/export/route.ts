import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { MAX_DESIGN_SLIDES, MAX_EXPORT_BYTES, storeDesignExports, toApiDesign, type ExportFile } from "@/lib/services/visualDesignService";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Réception des PNG rendus par le navigateur (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 « Export »).
 * Multipart : un champ `slide-<planNumber>` par fichier.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const form = await request.formData();
    const files: ExportFile[] = [];
    for (const [field, value] of form.entries()) {
      const match = /^slide-(\d+)$/.exec(field);
      if (!match || !(value instanceof File)) continue;
      if (!ALLOWED_MIME.has(value.type)) throw new ApiError(415, `Format d'image non supporté : ${value.type || "inconnu"}.`);
      if (value.size > MAX_EXPORT_BYTES) throw new ApiError(413, `Slide ${match[1]} : fichier trop lourd.`);
      files.push({ planNumber: Number(match[1]), bytes: Buffer.from(await value.arrayBuffer()), mimeType: value.type });
      if (files.length > MAX_DESIGN_SLIDES) throw new ApiError(400, `${MAX_DESIGN_SLIDES} slides maximum.`);
    }
    if (files.length === 0) throw new ApiError(400, "Aucune slide reçue.");
    const design = await storeDesignExports(userId, id, files);
    return NextResponse.json({ design: toApiDesign(design) });
  } catch (error) {
    return handleApiError(error);
  }
}

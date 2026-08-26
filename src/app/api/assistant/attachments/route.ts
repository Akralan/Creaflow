import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { createAttachment, listPendingAttachments } from "@/lib/services/assistantService";
import { ApiError, handleApiError } from "@/lib/api/errors";

// Mêmes limites que POST /api/materials/upload : c'est la même matière, déposée par une autre porte
// (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.1). Anti-scope SPEC_MATIERE_EDITEUR.md §3.2 : pas de PDF.
const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".md", ".txt"];

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({ attachments: await listPendingAttachments(userId) });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Dépôt d'un fichier dans la conversation. Le texte est extrait et stocké ici ; il n'entre PAS dans
 * la matière — le SourceMaterial ne naîtra qu'à l'acceptation de la proposition correspondante, et
 * l'assistant ne voit que le nom du fichier.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "Aucun fichier fourni.");
    }
    if (!ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      throw new ApiError(400, "Seuls les fichiers .md et .txt sont acceptés.");
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ApiError(400, "Fichier trop volumineux (2 Mo maximum).");
    }

    const attachment = await createAttachment(userId, file.name, await file.text());
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

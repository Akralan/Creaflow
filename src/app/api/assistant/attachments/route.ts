import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { createAttachment, listPendingAttachments } from "@/lib/services/assistantService";
import { ApiError, handleApiError } from "@/lib/api/errors";

// Same limits as POST /api/materials/upload: it is the same material, dropped through another door
// (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.1). Out of scope per SPEC_MATIERE_EDITEUR.md §3.2: no PDF.
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
 * A file dropped into the conversation. The text is extracted and stored here; it does NOT enter
 * the material — the SourceMaterial is only created when the matching proposal is accepted, and
 * until then the assistant only sees the file name.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "No file provided.");
    }
    if (!ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      throw new ApiError(400, "Only .md and .txt files are accepted.");
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new ApiError(400, "File too large (2 MB maximum).");
    }

    const attachment = await createAttachment(userId, file.name, await file.text());
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

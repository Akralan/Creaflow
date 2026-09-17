import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getDesignBaseImage } from "@/lib/services/visualDesignService";

/**
 * Image de base de la maquette, servie same-origin (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 « Base
 * de la slide ») : le canevas et l'export PNG la lisent sans CORS avec R2 ou Drive.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { bytes, mimeType } = await getDesignBaseImage(userId, id);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

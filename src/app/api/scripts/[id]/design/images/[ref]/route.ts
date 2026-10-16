import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getDesignImage } from "@/lib/services/visualDesignService";
import { DESIGN_IMAGE_VARIANTS, type DesignImageVariant } from "@/lib/visualDesign/designImages";

/**
 * Octets d'une photo de la maquette (`{{IMG:ref}}`), servis same-origin (docs/SPEC_COMPOSITION_VISUELLE.md
 * §5.2) : le canevas et l'export PNG la lisent sans CORS avec R2 ou Drive. `?variant=` permet au
 * client de demander l'autre variante ; un détouré pas encore calculé est servi comme l'original
 * (cette lecture ne déclenche jamais de détourage, voir `getDesignImage`).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; ref: string }> }) {
  try {
    const userId = await requireUserId();
    const { id, ref } = await params;
    const raw = request.nextUrl.searchParams.get("variant");
    const variant = raw && (DESIGN_IMAGE_VARIANTS as readonly string[]).includes(raw) ? (raw as DesignImageVariant) : undefined;
    const { bytes, mimeType } = await getDesignImage(userId, id, ref, variant);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

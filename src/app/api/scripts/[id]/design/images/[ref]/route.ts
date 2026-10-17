import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getDesignImage } from "@/lib/services/visualDesignService";
import { DESIGN_IMAGE_VARIANTS, type DesignImageVariant } from "@/lib/visualDesign/designImages";

/**
 * Bytes of a mockup photo (`{{IMG:ref}}`), served same-origin (docs/SPEC_COMPOSITION_VISUELLE.md
 * §5.2): the canvas and the PNG export read it without CORS with R2 or Drive. `?variant=` lets the
 * client ask for the other variant; a cutout not yet computed is served like the original
 * (this read never triggers background removal, see `getDesignImage`).
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

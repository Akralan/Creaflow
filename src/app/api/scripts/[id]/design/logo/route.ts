import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getBrandLogo } from "@/lib/services/visualDesignService";

/** Logo de l'identité de marque, servi same-origin pour le canevas et l'export. */
export async function GET() {
  try {
    const userId = await requireUserId();
    const { bytes, mimeType } = await getBrandLogo(userId);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

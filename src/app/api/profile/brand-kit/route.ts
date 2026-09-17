import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { saveBrandKit } from "@/lib/services/visualDesignService";

/** Identité de marque des maquettes (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2). Remplace le kit entier. */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const brandKit = await saveBrandKit(userId, await request.json());
    return NextResponse.json({ brandKit });
  } catch (error) {
    return handleApiError(error);
  }
}

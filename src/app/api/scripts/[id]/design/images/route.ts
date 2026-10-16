import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { addDesignImage, toApiDesignWithAssets } from "@/lib/services/visualDesignService";

const schema = z.object({ assetId: z.uuid() });

/** Ajoute une photo de la bibliothèque à la maquette sans recomposer (docs/SPEC_COMPOSITION_VISUELLE.md §6). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = schema.parse(await request.json());
    const { design, ref } = await addDesignImage(userId, id, body.assetId);
    return NextResponse.json({ design: await toApiDesignWithAssets(design), ref }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { createDesignForScript, deleteDesign, patchDesign, toApiDesign, MAX_DESIGN_SLIDES } from "@/lib/services/visualDesignService";
import { DESIGN_FORMATS } from "@/lib/visualDesign/formats";
import { MAX_SLIDE_HTML_BYTES } from "@/lib/visualDesign/htmlSanitizer";

const createSchema = z.object({
  baseKind: z.enum(["generated", "asset", "none"]),
  baseAssetId: z.uuid().optional().nullable(),
  format: z.enum(Object.keys(DESIGN_FORMATS) as [string, ...string[]]).optional(),
});

const patchSchema = z.object({
  slides: z
    .array(z.object({ planNumber: z.number().int().positive(), html: z.string().max(MAX_SLIDE_HTML_BYTES * 2) }))
    .max(MAX_DESIGN_SLIDES)
    .optional(),
  theme: z.unknown().optional(),
  // Animation : ligne de temps et durée (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §5.2).
  timeline: z.array(z.unknown()).max(24).optional(),
  durationMs: z.number().int().optional(),
});

/** Création de la maquette par l'agent (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §5.3). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    // Un appel LLM long (toutes les slides) — même limite que la génération d'image.
    await enforceRateLimit("design-compose", userId, 10, 60);
    const body = createSchema.parse(await request.json());
    const { design, rationale } = await createDesignForScript(userId, id, {
      baseKind: body.baseKind,
      baseAssetId: body.baseAssetId ?? null,
      format: body.format as keyof typeof DESIGN_FORMATS | undefined,
    });
    return NextResponse.json({ design: toApiDesign(design), rationale }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Retouche manuelle : HTML des slides et/ou thème, repassés par la liste blanche côté serveur. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const design = await patchDesign(userId, id, body);
    return NextResponse.json({ design: toApiDesign(design) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteDesign(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

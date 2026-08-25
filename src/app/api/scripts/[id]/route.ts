import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts, scriptStatusEnum } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { getObjectStorage } from "@/lib/storage";
import { deleteScriptForUser, patchScriptContent } from "@/lib/services/scriptService";
import { findBeatTitle } from "@/lib/services/narrativeDirector";
import { storyboardStepSchema } from "@/lib/llm/scriptSchema";

// Statut ET contenu (docs/SPEC_MATIERE_EDITEUR.md §4.5) — catégorie/angle/série volontairement
// absents : brief verrouillé, non modifiable depuis l'éditeur (§4.2).
const patchSchema = z
  .object({
    status: z.enum(scriptStatusEnum.enumValues).optional(),
    title: z.string().min(1).optional(),
    hookVisual: z.string().min(1).optional(),
    hookText: z.string().min(1).optional(),
    hookAudio: z.string().min(1).optional(),
    storyboard: z.array(storyboardStepSchema).min(1).optional(),
    caption: z.string().min(1).optional(),
    hashtags: z.array(z.string()).optional(),
    soundRecommendation: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const script = await db.query.scripts.findFirst({
      where: and(eq(scripts.id, id), eq(scripts.userId, userId)),
      with: {
        product: true,
        contentCategory: true,
        // Angle imposé, affiché en lecture seule dans le brief en en-tête de l'éditeur (§4.2).
        angle: { columns: { id: true, label: true, description: true } },
        series: { columns: { id: true, label: true } },
        metrics: true,
        generatedImage: true,
        // Matière utilisée (docs/SPEC_MATIERE_EDITEUR.md §3) — traçabilité affichée sur la fiche.
        citations: { with: { sourceMaterial: { columns: { title: true } } } },
      },
    });

    if (!script) {
      throw new ApiError(404, "Script introuvable.");
    }

    // Bandeau éditeur (docs/SPEC_REDACTEUR_EN_CHEF.md §7) — résolu à la lecture plutôt que stocké
    // (le titre d'un beat peut changer à la replanification, on veut toujours le libellé courant).
    const beatTitle = script.beatId ? await findBeatTitle(userId, script.productId, script.seriesId, script.beatId) : null;

    const { generatedImage, citations, ...rest } = script;
    return NextResponse.json({
      script: {
        ...rest,
        beatTitle,
        generatedImage: generatedImage
          ? { ...generatedImage, url: getObjectStorage().getPublicUrl(generatedImage.storageKey) }
          : null,
        citations: citations.map((c) => ({
          id: c.id,
          sourceMaterialId: c.sourceMaterialId,
          sourceMaterialTitle: c.sourceMaterial?.title ?? null,
          excerpt: c.excerpt,
          matched: c.matchStart !== null,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const script = await patchScriptContent(userId, id, body);

    return NextResponse.json({ script });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteScriptForUser(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

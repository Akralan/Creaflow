import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { importScriptForUser } from "@/lib/services/scriptImportService";
import { storyboardStepSchema } from "@/lib/llm/scriptSchema";
import { platformSchema, contentCategorySchema, contentTypeSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";

// Import d'un script écrit ailleurs (docs/SPEC_MATIERE_EDITEUR.md §2) — aucun appel LLM, aucun quota.
// Le rôle (contentCategoryId) reste obligatoire en post libre (décision §8.2 : colonne NOT NULL,
// pondération calendrier, sélection d'angle) ; avec une série, il en est dérivé
// (docs/SPEC_SERIES_ET_ROLES.md §4.2).
const schema = z
  .object({
    platform: platformSchema,
    contentCategoryId: contentCategorySchema.optional(),
    contentType: contentTypeSchema,
    productId: z.uuid().optional(),
    seriesId: z.uuid().optional(),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD").optional(),
    calendarEntryId: z.uuid().optional(),
    // Optionnels ici : l'écriture ailleurs (§2) impose les deux côté formulaire (ImportScriptForm),
    // la naissance paresseuse (§4.5) peut poser un seul bloc — importScriptForUser vérifie qu'au
    // moins un champ de contenu est rempli.
    title: z.string().min(1).optional(),
    caption: z.string().min(1).optional(),
    hashtags: z.array(z.string()).default([]),
    hookVisual: z.string().optional(),
    hookText: z.string().optional(),
    hookAudio: z.string().optional(),
    storyboard: z.array(storyboardStepSchema).optional(),
    soundRecommendation: z.string().optional(),
  })
  .refine((data) => !(data.scheduledDate && data.calendarEntryId), {
    message: "scheduledDate et calendarEntryId sont mutuellement exclusifs.",
  });

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = schema.parse(await request.json());
    const script = await importScriptForUser(userId, body, "imported");
    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

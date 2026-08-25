import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { narrativeBeatSchema, patchNarrativeStateForUser } from "@/lib/services/narrativeDirector";
import { handleApiError } from "@/lib/api/errors";

// Éditions utilisateur de l'écran Direction (docs/SPEC_REDACTEUR_EN_CHEF.md §6/§7) — validation de
// forme ici, validation des transitions autorisées (beat publié figé, statut → skipped seulement)
// dans narrativeDirector.ts (applyBeatsPatch).
const patchSchema = z
  .object({
    arcSummary: z.string().trim().min(1).optional(),
    formatContract: z.string().trim().min(1).nullable().optional(),
    beats: z.array(narrativeBeatSchema).optional(),
    callbacks: z.array(z.string()).optional(),
    closePromiseText: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Aucune modification fournie." });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const patch = patchSchema.parse(await request.json());
    const state = await patchNarrativeStateForUser(userId, id, patch);
    return NextResponse.json({ state });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { generateScript } from "@/lib/llm/generateScript";
import type { Platform } from "@/lib/llm/prompts";
import { buildGenerationContext, updateScriptRecord, recordBeatDraftedIfNeeded } from "@/lib/services/scriptService";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { directiveSchema } from "@/lib/validation";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const schema = z.object({ directive: directiveSchema });

/**
 * "Autre idée, même brief" (docs/SPEC_PROMPT_GENERATION_TECH.md §6) — remplace la régénération
 * complète désactivée (POST /api/scripts/:id/regenerate, encore présente en code mais désactivée
 * côté produit). Contrairement à ce regenerate, le geste est DIRIGÉ : le brief est intégralement
 * verrouillé (angle conservé, pas recalculé — §6.1 point 3) et le concept écarté est mémorisé pour
 * ne pas revenir dessus (rejectedConcepts, injecté au tour suivant).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    // Même appel LLM complet qu'une génération ou l'ancien regenerate — même limite partagée.
    await enforceRateLimit("script-generate", userId, 20, 60);
    const { id } = await params;
    // Body optionnel (champ "idée en tête" / bascule select-all, docs/SPEC_REDACTEUR_EN_CHEF.md Lot A)
    // — l'absence de body reste valide, comme avant l'ajout de la directive.
    const { directive } = schema.parse(await request.json().catch(() => ({})));
    await enforceScriptQuota(userId);

    const existing = await db.query.scripts.findFirst({
      where: and(eq(scripts.id, id), eq(scripts.userId, userId)),
    });
    if (!existing) {
      throw new ApiError(404, "Script introuvable.");
    }
    // §6.1 point 1 : un script importé/manuel n'a pas d'intention IA à remplacer.
    if (existing.origin !== "generated" || !existing.concept) {
      throw new ApiError(409, "Ce script n'a pas de concept généré à remplacer.");
    }

    // §6.1 point 2 : le concept qu'on s'apprête à remplacer rejoint la liste des refusés — calculé
    // avant l'appel LLM (et avant le choix du jour du chef, à qui il est aussi transmis, §3.3) mais
    // persisté seulement si la génération réussit (updateScriptRecord plus bas), pour ne rien écrire
    // si l'appel échoue.
    const rejectedConcepts = [...((existing.rejectedConcepts as string[] | null) ?? []), existing.concept];

    // Brief intégralement verrouillé : angle conservé (lockedAngleId) comme fallback sans chef, rien
    // d'autre ne change par rapport à une génération normale — plateforme/catégorie/série/produit
    // relus depuis le script. Le chef, s'il est actif, peut proposer une nouvelle direction (et donc
    // un nouvel angleHint) — "autre idée" n'est plus un simple changement de mots à brief identique
    // dès que le chef décide (docs/SPEC_REDACTEUR_EN_CHEF.md §4.1, Lot B3).
    const context = await buildGenerationContext(
      userId,
      existing.platform as Platform,
      existing.contentCategoryId,
      existing.contentType,
      existing.productId,
      existing.id,
      existing.seriesId,
      existing.angleId,
      directive,
      rejectedConcepts
    );
    context.rejectedConcepts = rejectedConcepts;

    const generated = await generateScript(context);
    const script = await updateScriptRecord(userId, existing.id, context.contentCategory, generated, {
      angleId: context.angle?.id ?? null,
      brandAssetId: context.brandAsset?.id ?? null,
      rejectedConcepts,
      beatId: context.direction?.beatId ?? null,
      // Script.productId reste verrouillé (existing.productId, jamais réécrit) mais les citations
      // doivent porter sur le même corpus que celui effectivement lu (hérité du sujet de la série
      // quand ce script n'en a pas lui-même, docs/SPEC_REDACTEUR_EN_CHEF.md, sélecteur de sujet).
      citationsProductId: context.resolvedProductId ?? null,
    });
    await recordBeatDraftedIfNeeded(context, script.id);

    return NextResponse.json({ script });
  } catch (error) {
    return handleApiError(error);
  }
}

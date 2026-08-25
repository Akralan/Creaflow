import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries } from "@/db/schema";
import { callStructured } from "@/lib/llm/provider";
import { generateScript } from "@/lib/llm/generateScript";
import type { ContentType, Platform } from "@/lib/llm/prompts";
import {
  MATERIAL_EPISODES_SYSTEM_PROMPT,
  buildMaterialEpisodesUserMessage,
  proposeSeriesEpisodesTool,
  seriesEpisodesResultSchema,
} from "@/lib/llm/materialEpisodes";
import { buildGenerationContext, createScriptRecord } from "@/lib/services/scriptService";
import { getMaterialForSubject } from "@/lib/services/sourceMaterialService";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { placeScriptOnCalendar } from "@/lib/services/scriptImportService";
import { logger } from "@/lib/logger";
import { ApiError } from "@/lib/api/errors";

const DEFAULT_SERIES_WEIGHT = 15;
// Cadence par défaut entre deux épisodes — aucun signal fiable de fréquence de publication par
// sujet à ce stade (les objectifs de fréquence sont par plateforme, pas par série) ; 3 jours est un
// compromis raisonnable, ajustable ensuite au calendrier comme n'importe quel script placé.
const DAYS_BETWEEN_EPISODES = 3;

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface GenerateSeriesFromMaterialParams {
  productId?: string | null;
  seriesId?: string;
  newSeries?: { label: string; description: string; weight?: number };
  platform: Platform;
  contentCategoryId: string;
  contentType: ContentType;
  episodeCount: number;
}

/**
 * Génère N scripts ordonnés rattachés à une même ContentSeries depuis le corpus d'un sujet
 * (docs/SPEC_MATIERE_EDITEUR.md §3.8) — le Module C en version texte, validé par le test fondateur.
 * Le LLM lit le texte brut complet et propose lui-même un découpage thématique en épisodes (titre +
 * angle) ; chaque épisode est ensuite généré normalement (buildGenerationContext/createScriptRecord,
 * générations complètes, quota inchangé §4.6), avec cette directive d'épisode en plus du texte brut
 * complet — c'est le LLM qui pioche lui-même dans la matière ce qui correspond à l'angle demandé,
 * pas une pré-assignation de fragments côté serveur.
 */
export async function generateSeriesFromMaterial(userId: string, params: GenerateSeriesFromMaterialParams) {
  if (!params.seriesId && !params.newSeries) {
    throw new ApiError(400, "Précise une série existante ou les informations d'une nouvelle série.");
  }

  let series: typeof contentSeries.$inferSelect;
  if (params.seriesId) {
    const found = await db.query.contentSeries.findFirst({
      where: and(eq(contentSeries.id, params.seriesId), eq(contentSeries.userId, userId)),
    });
    if (!found) {
      throw new ApiError(404, "Série introuvable.");
    }
    series = found;
  } else {
    const [created] = await db
      .insert(contentSeries)
      .values({
        userId,
        label: params.newSeries!.label,
        description: params.newSeries!.description,
        weight: params.newSeries!.weight ?? DEFAULT_SERIES_WEIGHT,
      })
      .returning();
    series = created;
  }

  const documents = await getMaterialForSubject(userId, params.productId ?? null);
  if (documents.length === 0) {
    throw new ApiError(400, "Aucune matière disponible pour ce sujet — colle du texte ou fais une interview d'abord.");
  }
  const combinedRawText = documents.map((d) => (d.title ? `[${d.title}]\n${d.rawText}` : d.rawText)).join("\n\n---\n\n");

  const episodeCount = Math.max(2, Math.min(params.episodeCount, 10));
  const args = await callStructured({
    system: MATERIAL_EPISODES_SYSTEM_PROMPT,
    userMessage: buildMaterialEpisodesUserMessage({
      seriesLabel: series.label,
      seriesDescription: series.description,
      episodeCount,
      rawText: combinedRawText,
    }),
    tool: proposeSeriesEpisodesTool,
    maxTokens: 2048,
  });
  const { episodes } = seriesEpisodesResultSchema.parse(args);

  const scripts = [];
  let episodeIndex = 0;
  for (const episode of episodes) {
    // Une génération complète par épisode — quota inchangé dans son principe (§4.6). On s'arrête
    // dès que le quota est atteint plutôt que d'échouer toute la série après coup : les épisodes
    // déjà générés sont conservés (chaque createScriptRecord commit indépendamment).
    try {
      await enforceScriptQuota(userId);
    } catch {
      break;
    }

    const context = await buildGenerationContext(
      userId,
      params.platform,
      params.contentCategoryId,
      params.contentType,
      params.productId ?? null,
      undefined,
      series.id
    );
    context.episodeDirective = { episodeTitle: episode.episodeTitle, angleHint: episode.angleHint };

    const generated = await generateScript(context);
    const script = await createScriptRecord(userId, params.platform, context.contentCategory, params.productId ?? null, generated, {
      angleId: context.angle?.id ?? null,
      seriesId: series.id,
      brandAssetId: context.brandAsset?.id ?? null,
    });
    scripts.push(script);

    // Posé directement sur un créneau (§3.8) — la mécanique de placement existante, réutilisée telle
    // quelle. Un échec de placement ne doit pas faire perdre le script déjà généré.
    episodeIndex += 1;
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + episodeIndex * DAYS_BETWEEN_EPISODES);
    try {
      await placeScriptOnCalendar(userId, script.id, toDateStr(scheduledDate));
    } catch (err) {
      logger.error("Placement au calendrier échoué pour un épisode de série", err, { scriptId: script.id });
    }
  }

  return { series, scripts };
}

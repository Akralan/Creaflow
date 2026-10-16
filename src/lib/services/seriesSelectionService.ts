import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries } from "@/db/schema";
import { keepOnlySeries, listActiveSeriesForUser } from "@/lib/services/seriesService";
import { planNarrativeForSubject } from "@/lib/services/narrativeDirector";
import { llmFailureMessage } from "@/lib/llm/errors";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { rescaleKeptWeights } from "@/lib/seriesWeights";

/**
 * Validation des séries à l'arrivée sur Direction, juste après l'onboarding : la personne décoche
 * celles qu'elle ne veut pas, valide, et tout le reste se fait pour elle — pourcentages recalculés,
 * plan de la série principale écrit, calendrier rempli (ce dernier par l'écran, via la génération
 * du calendrier existante).
 */

export async function confirmSeriesSelection(userId: string, keptIds: string[]) {
  if (keptIds.length === 0) {
    throw new ApiError(400, "Garde au moins une série.");
  }
  const before = await listActiveSeriesForUser(userId);
  await keepOnlySeries(userId, keptIds);

  for (const { id, weight } of rescaleKeptWeights(before, keptIds)) {
    await db
      .update(contentSeries)
      .set({ weight })
      .where(and(eq(contentSeries.id, id), eq(contentSeries.userId, userId)));
  }

  // La série la plus lourde qui se planifie : une série rendez_vous n'a pas de plan (épisodes
  // autonomes), on passe à la suivante.
  const series = await listActiveSeriesForUser(userId);
  const toPlan = series.find((s) => s.mode === "feuilleton") ?? null;
  let planError: string | null = null;
  if (toPlan) {
    try {
      await planNarrativeForSubject(userId, { seriesId: toPlan.id });
    } catch (error) {
      // La sélection est faite et reste faite : seul le plan est à relancer, depuis la série.
      logger.warn("Planification après validation des séries impossible", {
        error: error instanceof Error ? error.message : String(error),
      });
      planError = `${llmFailureMessage(error)} Tes séries sont enregistrées : relance le plan depuis la série.`;
    }
  }

  return { plannedSeriesId: toPlan?.id ?? null, planError };
}

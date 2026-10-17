import { keepOnlySeries } from "@/lib/services/seriesService";
import { ensureReaderForSeries } from "@/lib/services/seriesReaderService";

/**
 * Validation des séries à l'arrivée sur Direction, juste après l'onboarding : la personne décoche
 * celles qu'elle ne veut pas, valide, et tout le reste se fait pour elle — ses jours de publication
 * répartis entre les séries gardées et le calendrier rempli (par keepOnlySeries,
 * docs/SPEC_RYTHME_DES_SERIES.md §5), puis le public principal du sujet et la forme attribués à
 * chaque série (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4, un appel LLM par série, jamais bloquant).
 */
export async function confirmSeriesSelection(userId: string, keptIds: string[]) {
  await keepOnlySeries(userId, keptIds);
  for (const id of keptIds) await ensureReaderForSeries(userId, id);
  return { plannedSeriesId: keptIds[0] ?? null, planError: null as string | null };
}

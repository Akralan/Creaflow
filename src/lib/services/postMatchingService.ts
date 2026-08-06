/**
 * Heuristique de rattachement post↔script (docs/SPEC_METRIQUES_AUTO.md §4, piste retenue :
 * heuristique de pré-remplissage + confirmation utilisateur unique). Purement déterministe,
 * pas d'appel LLM — même esprit que performanceService.ts. Fonctions pures, sans DB : la
 * lecture (candidats scripts) et l'écriture (postMatchCandidates) vivent dans
 * postMetricsFetchService.ts.
 */

const DATE_PROXIMITY_WINDOW_DAYS = 7;
const DATE_WEIGHT = 0.5;
const CAPTION_WEIGHT = 0.5;

/** Score minimal pour proposer un candidat à confirmation — volontairement bas : c'est une
 *  suggestion pré-remplie, pas une décision automatique, mieux vaut proposer un faux positif
 *  que rater un vrai match. */
export const MATCH_SCORE_THRESHOLD = 0.35;

export interface MatchablePost {
  publishedAt?: Date;
  captionText?: string;
}

export interface MatchableScript {
  /** Date de publication prévue (CalendarEntry.scheduledDate), pas Script.createdAt qui ne
   *  reflète pas la date de publication réelle. */
  scheduledDate: Date | null;
  caption: string | null;
}

/** Tokenise pour la similarité de caption : minuscule, URLs et hashtags retirés (les hashtags
 *  sont déjà un champ Script.hashtags séparé), ponctuation/emoji hors lettres et chiffres retirés. */
function tokenize(text: string | null | undefined): Set<string> {
  if (!text) return new Set();
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/#\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  return new Set(cleaned.split(/\s+/).filter((token) => token.length > 1));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Score de correspondance 0-1 entre un post récupéré via API et un script candidat :
 *  50% proximité de date (0 au-delà de 7 jours d'écart), 50% similarité Jaccard des captions. */
export function scorePostMatch(post: MatchablePost, candidate: MatchableScript): number {
  let dateScore = 0;
  if (post.publishedAt && candidate.scheduledDate) {
    const daysDiff =
      Math.abs(post.publishedAt.getTime() - candidate.scheduledDate.getTime()) / (1000 * 60 * 60 * 24);
    dateScore = Math.max(0, 1 - daysDiff / DATE_PROXIMITY_WINDOW_DAYS);
  }

  const captionScore = jaccardSimilarity(tokenize(post.captionText), tokenize(candidate.caption));

  return DATE_WEIGHT * dateScore + CAPTION_WEIGHT * captionScore;
}

/** Meilleur script candidat pour un post donné, au-dessus du seuil — null si aucun candidat
 *  n'atteint MATCH_SCORE_THRESHOLD. Un post ne garde qu'un seul candidat (contrainte unique
 *  (platform, platformPostId) sur postMatchCandidates). */
export function findBestMatchingScript<T extends MatchableScript>(
  post: MatchablePost,
  candidates: T[]
): { script: T; score: number } | null {
  let best: { script: T; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scorePostMatch(post, candidate);
    if (score >= MATCH_SCORE_THRESHOLD && (!best || score > best.score)) {
      best = { script: candidate, score };
    }
  }
  return best;
}

/**
 * Post↔script link heuristic (docs/SPEC_METRIQUES_AUTO.md §4, approach chosen:
 * heuristic (pre-fill + single user confirmation). Purely deterministic,
 * no LLM call — same spirit as performanceService.ts. Pure functions, no DB: reading
 * (candidate scripts) and writing (postMatchCandidates) live in
 * postMetricsFetchService.ts.
 */

const DATE_PROXIMITY_WINDOW_DAYS = 7;
const DATE_WEIGHT = 0.5;
const CAPTION_WEIGHT = 0.5;

/** Minimum score to propose a candidate for confirmation — deliberately low: it is a
 *  pre-filled suggestion, not an automatic decision, better to propose a false positive
 *  than to miss a real match. */
export const MATCH_SCORE_THRESHOLD = 0.35;

export interface MatchablePost {
  publishedAt?: Date;
  captionText?: string;
}

export interface MatchableScript {
  /** Planned publication date (CalendarEntry.scheduledDate), not Script.createdAt which does not
   *  reflect the real publication date. */
  scheduledDate: Date | null;
  caption: string | null;
}

/** Tokenises for caption similarity: lowercase, URLs and hashtags removed (hashtags
 *  are already a separate Script.hashtags field), punctuation/emoji other than letters and digits removed. */
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

/** Match score 0-1 between a post retrieved via API and a candidate script:
 *  50% date proximity (0 beyond 7 days apart), 50% Jaccard similarity of captions. */
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

/** Best candidate script for a given post, above the threshold — null if no candidate
 *  reaches MATCH_SCORE_THRESHOLD. A post keeps only one candidate (unique constraint
 *  (platform, platformPostId) on postMatchCandidates). */
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

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { postMatchCandidates, postMetrics, postMetricsSnapshots, scripts, socialConnections } from "@/db/schema";
import { hasMetricsFetch, socialProviders } from "@/lib/social";
import { getValidSocialAccessToken } from "@/lib/services/socialConnectionService";
import { findBestMatchingScript, type MatchableScript } from "@/lib/services/postMatchingService";

// Dédup configurable par plateforme : seule X est payante à l'appel (docs/SPEC_METRIQUES_AUTO.md
// §2.5, $0.005/lecture) — les autres plateformes sont gratuites ou à quota généreux et n'ont pas
// besoin de throttle. Générique plutôt qu'un cas particulier codé en dur pour X.
const MIN_REFETCH_INTERVAL_HOURS: Partial<Record<string, number>> = {
  x: 24,
};

export interface FetchAndMatchResult {
  /** Posts déjà rattachés dont les métriques ont été mises à jour. */
  updated: number;
  /** Nouveaux candidats de rattachement créés, en attente de confirmation utilisateur. */
  candidatesCreated: number;
  /** true si le fetch a été sauté (dédup 24h) plutôt qu'exécuté. */
  skipped: boolean;
}

const NOOP_RESULT: FetchAndMatchResult = { updated: 0, candidatesCreated: 0, skipped: false };

/**
 * Récupère les métriques d'une plateforme pour un utilisateur, met à jour les posts déjà
 * rattachés (historique + vue courante), et propose des candidats de rattachement pour les
 * posts inconnus (docs/SPEC_METRIQUES_AUTO.md §4). Refresh de token lazy à l'usage, appelé
 * depuis POST /api/performance/refresh — aucun cron dans ce repo (§7.5).
 *
 * Ne génère PAS la proposition de re-pondération elle-même : categoryReweightService agrège le
 * signal sur toutes les plateformes d'un utilisateur, donc maybeGenerateCategoryReweightProposal
 * est appelé une seule fois par l'appelant après avoir fetché toutes les plateformes connectées.
 */
export async function fetchAndMatchPostsForUser(userId: string, platform: string): Promise<FetchAndMatchResult> {
  if (!hasMetricsFetch(platform)) {
    return NOOP_RESULT;
  }

  const connection = await db.query.socialConnections.findFirst({
    where: and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)),
  });
  if (!connection) {
    return NOOP_RESULT;
  }

  const minIntervalHours = MIN_REFETCH_INTERVAL_HOURS[platform];
  if (minIntervalHours && connection.lastMetricsFetchAt) {
    const hoursSinceLastFetch = (Date.now() - connection.lastMetricsFetchAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastFetch < minIntervalHours) {
      return { ...NOOP_RESULT, skipped: true };
    }
  }

  // Propage ApiError 409 ("needs_reconnect") si le refresh échoue — laissé à l'appelant, qui
  // agrège les erreurs par plateforme via Promise.allSettled sans bloquer les autres.
  const accessToken = await getValidSocialAccessToken(userId, platform);
  const provider = socialProviders[platform]!;
  const posts = await provider.fetchPostMetrics!({ accessToken, platformUserId: connection.platformUserId });

  // Scripts candidats au rattachement, chargés une seule fois : même utilisateur, même
  // plateforme, pas déjà rattachés à un post confirmé (platformPostId renseigné).
  const scriptRows = await db.query.scripts.findMany({
    where: and(eq(scripts.userId, userId), eq(scripts.platform, platform)),
    columns: { id: true, caption: true },
    with: {
      metrics: { columns: { platformPostId: true } },
      calendarEntries: { columns: { scheduledDate: true } },
    },
  });
  const availableScripts: Array<MatchableScript & { id: string }> = scriptRows
    .filter((s) => !s.metrics?.platformPostId)
    .map((s) => ({
      id: s.id,
      caption: s.caption,
      scheduledDate: s.calendarEntries[0]?.scheduledDate ?? null,
    }));

  let updated = 0;
  let candidatesCreated = 0;

  for (const post of posts) {
    const existingMetrics = await db.query.postMetrics.findFirst({
      where: eq(postMetrics.platformPostId, post.platformPostId),
    });

    if (existingMetrics) {
      await db
        .update(postMetrics)
        .set({
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          source: "api",
          fetchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(postMetrics.id, existingMetrics.id));
      await db.insert(postMetricsSnapshots).values({
        scriptId: existingMetrics.scriptId,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        source: "api",
      });
      updated++;
      continue;
    }

    // Déjà proposé (pending/confirmed/dismissed) : mémorisation définitive, jamais reproposé.
    const existingCandidate = await db.query.postMatchCandidates.findFirst({
      where: and(eq(postMatchCandidates.platform, platform), eq(postMatchCandidates.platformPostId, post.platformPostId)),
    });
    if (existingCandidate) continue;

    const best = findBestMatchingScript({ publishedAt: post.publishedAt, captionText: post.captionText }, availableScripts);
    if (!best) continue;

    await db.insert(postMatchCandidates).values({
      userId,
      scriptId: best.script.id,
      platform,
      platformPostId: post.platformPostId,
      externalUrl: post.externalUrl,
      captionText: post.captionText ?? null,
      publishedAt: post.publishedAt ?? null,
      score: best.score,
      metrics: { views: post.views, likes: post.likes, comments: post.comments, shares: post.shares },
    });
    candidatesCreated++;
  }

  await db.update(socialConnections).set({ lastMetricsFetchAt: new Date() }).where(eq(socialConnections.id, connection.id));

  return { updated, candidatesCreated, skipped: false };
}

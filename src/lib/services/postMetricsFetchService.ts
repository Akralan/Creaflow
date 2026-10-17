import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { postMatchCandidates, postMetrics, postMetricsSnapshots, scripts, socialConnections } from "@/db/schema";
import { hasMetricsFetch, socialProviders } from "@/lib/social";
import { getValidSocialAccessToken } from "@/lib/services/socialConnectionService";
import { findBestMatchingScript, type MatchableScript } from "@/lib/services/postMatchingService";

// Configurable dedup per platform: only X is paid per call (docs/SPEC_METRIQUES_AUTO.md
// §2.5, $0.005/read) — the other platforms are free or have a generous quota and need no
// throttle. Generic rather than a special case hard-coded for X.
const MIN_REFETCH_INTERVAL_HOURS: Partial<Record<string, number>> = {
  x: 24,
};

export interface FetchAndMatchResult {
  /** Already-linked posts whose metrics were updated. */
  updated: number;
  /** New link candidates created, awaiting user confirmation. */
  candidatesCreated: number;
  /** true if the fetch was skipped (24h dedup) rather than executed. */
  skipped: boolean;
}

const NOOP_RESULT: FetchAndMatchResult = { updated: 0, candidatesCreated: 0, skipped: false };

/**
 * Retrieves a platform's metrics for a user, updates the posts already
 * linked (history + current view), and proposes link candidates for
 * unknown posts (docs/SPEC_METRIQUES_AUTO.md §4). Lazy token refresh on use, called
 * from POST /api/performance/refresh — no cron in this repo (§7.5).
 *
 * Does NOT generate the reweighting proposal itself: categoryReweightService aggregates the
 * signal across all of a user's platforms, so maybeGenerateCategoryReweightProposal
 * is called only once by the caller after fetching all connected platforms.
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

  // Propagates ApiError 409 ("needs_reconnect") if the refresh fails — left to the caller, which
  // aggregates errors per platform via Promise.allSettled without blocking the others.
  const accessToken = await getValidSocialAccessToken(userId, platform);
  const provider = socialProviders[platform]!;
  const posts = await provider.fetchPostMetrics!({ accessToken, platformUserId: connection.platformUserId });

  // Candidate scripts for linking, loaded only once: same user, same
  // platform, not already linked to a confirmed post (platformPostId set).
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

    // Already proposed (pending/confirmed/dismissed): permanently remembered, never proposed again.
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

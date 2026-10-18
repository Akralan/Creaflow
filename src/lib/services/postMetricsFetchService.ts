import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, postMatchCandidates, postMetrics, postMetricsSnapshots, scripts, socialConnections } from "@/db/schema";
import { hasMetricsFetch, socialProviders } from "@/lib/social";
import type { PlatformPostMetric } from "@/lib/social/types";
import { fetchXMetricsViaApify, xMetricsProvider } from "@/lib/social/xApify";
import { getValidSocialAccessToken } from "@/lib/services/socialConnectionService";
import { classifyMatch, type MatchableScript } from "@/lib/services/postMatchingService";
import { linkPostToScript } from "@/lib/services/postLinkService";

// Configurable dedup per platform: only X is paid per call through its API (docs/SPEC_METRIQUES_AUTO.md
// §2.5, $0.005/read) — the other platforms are free or have a generous quota and need no
// throttle. Generic rather than a special case hard-coded for X.
const MIN_REFETCH_INTERVAL_HOURS: Partial<Record<string, number>> = {
  x: 24,
};

// Through Apify a read costs a few thousandths of a cent (docs/SPEC_PERFORMANCE.md §4), so the throttle is
// there to keep a page that is reloaded ten times from running ten scrapes, not to save money. It lives in the
// database (`creator_profiles.x_last_read_at`) and is claimed BEFORE the call: two requests at once, a failed
// run and a restart all count, so none of them can start a second scrape inside the window.
const APIFY_MIN_REFETCH_HOURS = 6;
/** After a failed run the next try comes this much sooner than a normal window, instead of waiting the whole of it. */
const APIFY_RETRY_AFTER_FAILURE_HOURS = 1;
const HOUR_MS = 3600_000;

export interface FetchAndMatchResult {
  /** Already-linked posts whose metrics were updated. */
  updated: number;
  /** New posts linked on their own (a sure match), which makes their script « Posted ». */
  linked: number;
  /** New link candidates created, awaiting user confirmation. */
  candidatesCreated: number;
  /** Posts that could not be saved (a bad number, a race with another request); the others went through. */
  failed: number;
  /** true if the fetch was skipped (dedup) rather than executed. */
  skipped: boolean;
}

const NOOP_RESULT: FetchAndMatchResult = { updated: 0, linked: 0, candidatesCreated: 0, failed: 0, skipped: false };

/** Platforms whose numbers can be read for this user: connected ones, plus X when Apify reads it from a handle. */
export async function platformsToFetch(userId: string): Promise<string[]> {
  const connections = await db.query.socialConnections.findMany({
    where: eq(socialConnections.userId, userId),
    columns: { platform: true },
  });
  const platforms = new Set(connections.map((c) => c.platform).filter(hasMetricsFetch));
  if (xMetricsProvider() === "apify") {
    const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { xHandle: true } });
    if (profile?.xHandle) platforms.add("x");
    else platforms.delete("x");
  }
  return [...platforms];
}

/** Takes the right to read X through Apify now, or says someone already did within the window. Atomic. */
async function claimApifyRead(userId: string): Promise<boolean> {
  const claimed = await db
    .update(creatorProfiles)
    .set({ xLastReadAt: new Date() })
    .where(
      and(
        eq(creatorProfiles.userId, userId),
        or(isNull(creatorProfiles.xLastReadAt), lt(creatorProfiles.xLastReadAt, new Date(Date.now() - APIFY_MIN_REFETCH_HOURS * HOUR_MS)))
      )
    )
    .returning({ id: creatorProfiles.id });
  return claimed.length > 0;
}

/** The posts of a platform as the network reports them, or null when there is nothing to read right now. */
async function readPosts(
  userId: string,
  platform: string
): Promise<{ posts: PlatformPostMetric[]; done: () => Promise<void> } | "skipped" | null> {
  const connection = await db.query.socialConnections.findFirst({
    where: and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)),
  });
  const markFetched = async () => {
    if (connection)
      await db.update(socialConnections).set({ lastMetricsFetchAt: new Date() }).where(eq(socialConnections.id, connection.id));
  };

  if (platform === "x" && xMetricsProvider() === "apify") {
    const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { xHandle: true } });
    if (!profile?.xHandle) return null;
    if (!(await claimApifyRead(userId))) return "skipped";
    try {
      return { posts: await fetchXMetricsViaApify(profile.xHandle), done: markFetched };
    } catch (error) {
      // Try again sooner than a full window, but not on the next request.
      await db
        .update(creatorProfiles)
        .set({ xLastReadAt: new Date(Date.now() - (APIFY_MIN_REFETCH_HOURS - APIFY_RETRY_AFTER_FAILURE_HOURS) * HOUR_MS) })
        .where(eq(creatorProfiles.userId, userId));
      throw error;
    }
  }

  if (!connection) return null;
  const minIntervalHours = MIN_REFETCH_INTERVAL_HOURS[platform];
  if (minIntervalHours && connection.lastMetricsFetchAt) {
    const hoursSinceLastFetch = (Date.now() - connection.lastMetricsFetchAt.getTime()) / HOUR_MS;
    if (hoursSinceLastFetch < minIntervalHours) return "skipped";
  }

  // Propagates ApiError 409 ("needs_reconnect") if the refresh fails — left to the caller, which
  // aggregates errors per platform via Promise.allSettled without blocking the others.
  const accessToken = await getValidSocialAccessToken(userId, platform);
  const posts = await socialProviders[platform]!.fetchPostMetrics!({ accessToken, platformUserId: connection.platformUserId });
  return { posts, done: markFetched };
}

/**
 * Retrieves a platform's metrics for a user, updates the posts already
 * linked (history + current view), links the posts that clearly match a script, and proposes link
 * candidates for the others (docs/SPEC_METRIQUES_AUTO.md §4, docs/SPEC_PERFORMANCE.md §4). Lazy token
 * refresh on use, called from POST /api/performance/refresh — no cron in this repo (§7.5).
 *
 * Everything is looked up among THIS user's scripts and candidates: a post id that belongs to someone else's
 * script is never touched, and one post that cannot be saved does not stop the others.
 */
export async function fetchAndMatchPostsForUser(userId: string, platform: string): Promise<FetchAndMatchResult> {
  if (!hasMetricsFetch(platform)) return NOOP_RESULT;

  const read = await readPosts(userId, platform);
  if (read === null) return NOOP_RESULT;
  if (read === "skipped") return { ...NOOP_RESULT, skipped: true };
  const { posts, done } = read;

  // Candidate scripts for linking, loaded only once: same user, same
  // platform, not already linked to a confirmed post (platformPostId set).
  const scriptRows = await db.query.scripts.findMany({
    where: and(eq(scripts.userId, userId), eq(scripts.platform, platform)),
    columns: { id: true, caption: true },
    with: {
      metrics: { columns: { platformPostId: true } },
      calendarEntries: { columns: { scheduledDate: true }, orderBy: (c, { asc }) => [asc(c.scheduledDate)] },
    },
  });
  const userScriptIds = scriptRows.map((s) => s.id);
  let availableScripts: Array<MatchableScript & { id: string }> = scriptRows
    .filter((s) => !s.metrics?.platformPostId)
    .map((s) => ({
      id: s.id,
      caption: s.caption,
      scheduledDate: s.calendarEntries[0]?.scheduledDate ?? null,
    }));

  const result: FetchAndMatchResult = { ...NOOP_RESULT };

  async function handle(post: PlatformPostMetric): Promise<void> {
    const existingMetrics =
      userScriptIds.length > 0
        ? await db.query.postMetrics.findFirst({
            where: and(eq(postMetrics.platformPostId, post.platformPostId), inArray(postMetrics.scriptId, userScriptIds)),
          })
        : undefined;
    if (existingMetrics) {
      await db
        .update(postMetrics)
        .set({
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          source: "api",
          // Keep the date the network gave (Performance files the post under the week it went out); a
          // fetch that returns none must not erase one we already have.
          ...(post.publishedAt ? { publishedAt: post.publishedAt } : {}),
          fetchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(postMetrics.id, existingMetrics.id));
      // A snapshot is a point of the history: written when a number moved, not at every opening of the screen.
      const moved =
        existingMetrics.views !== post.views ||
        existingMetrics.likes !== post.likes ||
        existingMetrics.comments !== post.comments ||
        existingMetrics.shares !== post.shares;
      if (moved) {
        await db.insert(postMetricsSnapshots).values({
          scriptId: existingMetrics.scriptId,
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          source: "api",
        });
      }
      result.updated++;
      return;
    }

    // Already proposed to this user (pending/confirmed/dismissed): permanently remembered, never proposed again.
    const existingCandidate = await db.query.postMatchCandidates.findFirst({
      where: and(
        eq(postMatchCandidates.userId, userId),
        eq(postMatchCandidates.platform, platform),
        eq(postMatchCandidates.platformPostId, post.platformPostId)
      ),
    });
    if (existingCandidate) return;

    const match = classifyMatch({ publishedAt: post.publishedAt, captionText: post.captionText }, availableScripts);
    if (!match) return;
    // One script, one post: whether it is linked now or only proposed, it is not offered to the next post.
    availableScripts = availableScripts.filter((s) => s.id !== match.script.id);

    if (match.auto) {
      await db.transaction((tx) =>
        linkPostToScript(tx, {
          userId,
          scriptId: match.script.id,
          platformPostId: post.platformPostId,
          publishedAt: post.publishedAt ?? null,
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
        })
      );
      result.linked++;
      return;
    }

    await db.insert(postMatchCandidates).values({
      userId,
      scriptId: match.script.id,
      platform,
      platformPostId: post.platformPostId,
      externalUrl: post.externalUrl,
      captionText: post.captionText ?? null,
      publishedAt: post.publishedAt ?? null,
      score: match.score,
      metrics: { views: post.views, likes: post.likes, comments: post.comments, shares: post.shares },
    });
    result.candidatesCreated++;
  }

  for (const post of posts) {
    try {
      await handle(post);
    } catch (error) {
      // A number the database refuses, or a second request that got there first: skip this post, keep the rest.
      result.failed++;
      console.error(
        `Performance: post ${post.platformPostId} on ${platform} was not saved`,
        error instanceof Error ? error.message : error
      );
    }
  }

  await done();

  return result;
}

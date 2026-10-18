import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, postMatchCandidates, scripts, socialConnections } from "@/db/schema";
import { xMetricsProvider } from "@/lib/social/xApify";
import { NETWORKS, type Network } from "@/lib/weekPosts";
import {
  buildPosts,
  medianImpressions,
  weekTotals,
  windowStarts,
  type MetricRow,
  type OverviewPost,
  type WeekTotals,
} from "@/lib/performance/derive";

/**
 * What `GET /api/performance/overview` returns (docs/SPEC_PERFORMANCE.md §5): the last four weeks, the posts
 * in them and the median — everything the screen needs to render, and to change week without another call.
 */

/** `needs_handle`: X is read from a handle (Apify) and none was given yet — see docs/SPEC_PERFORMANCE.md §4. */
export type ConnectionState = "ok" | "needs_reconnect" | "not_connected" | "needs_handle";

export interface PerformanceOverview {
  /** The four weeks, oldest first, the current one last. */
  weeks: WeekTotals[];
  /** Posts that went out in those weeks, oldest first. */
  posts: OverviewPost[];
  /** Median impressions per post over the window; null under five posts. */
  medianImpressions: number | null;
  connections: Record<Network, ConnectionState>;
  /** How X is connected: `handle` (a pseudo, read through Apify) or `oauth` (the X API). LinkedIn is always `oauth`. */
  xMethod: "handle" | "oauth";
  /** Posts spotted on a network and waiting for the user to say whether they are the one. */
  pendingCandidates: number;
}

export async function getPerformanceOverview(userId: string, now: Date = new Date()): Promise<PerformanceOverview> {
  // Only scripts linked to a real post count (spec D5): a manual entry has no platformPostId.
  const scriptRows = await db.query.scripts.findMany({
    where: and(eq(scripts.userId, userId), inArray(scripts.platform, [...NETWORKS])),
    columns: { id: true, platform: true, title: true, seriesId: true },
    with: {
      metrics: true,
      calendarEntries: { columns: { scheduledDate: true }, orderBy: (c, { asc }) => [asc(c.scheduledDate)] },
    },
  });

  const rows: MetricRow[] = scriptRows
    .filter((s) => s.metrics?.platformPostId)
    .map((s) => ({
      scriptId: s.id,
      seriesId: s.seriesId,
      platform: s.platform,
      title: s.title,
      scheduledDate: s.calendarEntries[0]?.scheduledDate ?? null,
      publishedAt: s.metrics!.publishedAt,
      metrics: {
        impressions: s.metrics!.views,
        likes: s.metrics!.likes,
        comments: s.metrics!.comments,
        shares: s.metrics!.shares,
      },
    }));

  const starts = windowStarts(now);
  const posts = buildPosts(rows).filter((p) => starts.includes(p.weekStart));

  const connectionRows = await db.query.socialConnections.findMany({
    where: eq(socialConnections.userId, userId),
    columns: { platform: true, status: true },
  });
  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, userId),
    columns: { xHandle: true },
  });
  const connections = Object.fromEntries(
    NETWORKS.map((network) => {
      const row = connectionRows.find((c) => c.platform === network);
      let state: ConnectionState = !row ? "not_connected" : row.status === "needs_reconnect" ? "needs_reconnect" : "ok";
      // X read through Apify needs a handle, not a connection.
      if (network === "x" && xMetricsProvider() === "apify") state = profile?.xHandle ? "ok" : "needs_handle";
      return [network, state];
    })
  ) as Record<Network, ConnectionState>;

  const [pending] = await db
    .select({ n: count() })
    .from(postMatchCandidates)
    .where(and(eq(postMatchCandidates.userId, userId), eq(postMatchCandidates.status, "pending")));

  return {
    weeks: weekTotals(posts, starts),
    posts,
    medianImpressions: medianImpressions(posts),
    connections,
    xMethod: xMetricsProvider() === "apify" ? "handle" : "oauth",
    pendingCandidates: pending?.n ?? 0,
  };
}

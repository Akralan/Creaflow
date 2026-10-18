import { addDays, dayKey, mondayOf, NETWORKS, type Network } from "@/lib/weekPosts";

/**
 * What the Performance screen shows, computed from the metrics of the posts that went out
 * (docs/SPEC_PERFORMANCE.md §3, §5). Pure — no database, no screen — so the server builds the JSON with it and
 * the client derives the deltas, the best post and the headline from that same JSON without another call.
 * Weeks run Monday to Sunday in UTC, like the rest of the app (`weekPosts.ts`).
 */

export interface NetworkMetrics {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
}

/** One script's current metrics, as the server reads them (a post is one row per network). */
export interface MetricRow {
  seriesId: string | null;
  scriptId: string;
  platform: string;
  title: string | null;
  /** Date the calendar planned — the fallback when the network gave no publication date. */
  scheduledDate: Date | null;
  publishedAt: Date | null;
  metrics: NetworkMetrics;
}

export interface OverviewPost {
  /** `seriesId|YYYY-MM-DD` of the planned slot, or the script id for a post outside a series. */
  key: string;
  /** ISO instant the post went out (the earliest of its versions). */
  publishedAt: string;
  /** Monday (`YYYY-MM-DD`) of the week the post went out. */
  weekStart: string;
  title: string;
  linkedin: NetworkMetrics | null;
  x: NetworkMetrics | null;
}

export interface WeekTotals extends NetworkMetrics {
  /** Monday, `YYYY-MM-DD`. */
  start: string;
  posts: number;
  byNetwork: Record<Network, NetworkMetrics>;
}

/** Below this many posts the median says nothing: no « × your usual reach » (spec §3). */
export const MIN_POSTS_FOR_MEDIAN = 5;

export const emptyMetrics = (): NetworkMetrics => ({
  impressions: 0,
  likes: 0,
  comments: 0,
  shares: 0,
});

function addMetrics(a: NetworkMetrics, b: NetworkMetrics): NetworkMetrics {
  return {
    impressions: a.impressions + b.impressions,
    likes: a.likes + b.likes,
    comments: a.comments + b.comments,
    shares: a.shares + b.shares,
  };
}

function isNetwork(platform: string): platform is Network {
  return (NETWORKS as readonly string[]).includes(platform);
}

/**
 * Groups the rows into posts — the LinkedIn and the X version of one slot become one post — and files each
 * under the week it went out. A row with no date at all, or on another network, is left out.
 */
export function buildPosts(rows: MetricRow[]): OverviewPost[] {
  interface Group {
    key: string;
    date: Date;
    versions: Partial<Record<Network, MetricRow>>;
  }
  const groups: Group[] = [];
  const bySlot = new Map<string, Group[]>();

  // Oldest first, then by id, so which version lands in which group never depends on the order rows came in.
  const dated = rows
    .filter((r) => isNetwork(r.platform) && (r.publishedAt ?? r.scheduledDate))
    .sort((a, b) => +(a.publishedAt ?? a.scheduledDate!) - +(b.publishedAt ?? b.scheduledDate!) || a.scriptId.localeCompare(b.scriptId));

  for (const row of dated) {
    const network = row.platform as Network;
    const date = (row.publishedAt ?? row.scheduledDate)!;
    // Same series and same planned day = the two versions of one post. Outside a series the same holds
    // (`weekPosts.groupPosts` does the same), and a second script of the same network on that slot is another post.
    const slot = `${row.seriesId ?? "free"}|${row.scheduledDate ? dayKey(row.scheduledDate) : dayKey(date)}`;
    const candidates = bySlot.get(slot) ?? [];
    let group = candidates.find((g) => !g.versions[network]);
    if (!group) {
      group = { key: candidates.length === 0 ? slot : `${slot}#${candidates.length + 1}`, date, versions: {} };
      candidates.push(group);
      bySlot.set(slot, candidates);
      groups.push(group);
    }
    group.versions[network] = row;
    if (date < group.date) group.date = date;
  }

  const posts: OverviewPost[] = groups.map(({ key, date, versions }) => ({
    key,
    publishedAt: date.toISOString(),
    weekStart: dayKey(mondayOf(date)),
    title: (versions.linkedin?.title || versions.x?.title || "").trim() || "(untitled)",
    linkedin: versions.linkedin?.metrics ?? null,
    x: versions.x?.metrics ?? null,
  }));
  return posts.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.key.localeCompare(b.key));
}

/** The Mondays of the `count` weeks ending with the one holding `now`, oldest first. */
export function windowStarts(now: Date, count = 4): string[] {
  const current = mondayOf(now);
  return Array.from({ length: count }, (_, i) => dayKey(addDays(current, (i - (count - 1)) * 7)));
}

/** Per-week sums for the given Mondays — a week with no post is all zeros. */
export function weekTotals(posts: OverviewPost[], starts: string[]): WeekTotals[] {
  return starts.map((start) => {
    const inWeek = posts.filter((p) => p.weekStart === start);
    const byNetwork: Record<Network, NetworkMetrics> = {
      linkedin: emptyMetrics(),
      x: emptyMetrics(),
    };
    for (const post of inWeek) {
      if (post.linkedin) byNetwork.linkedin = addMetrics(byNetwork.linkedin, post.linkedin);
      if (post.x) byNetwork.x = addMetrics(byNetwork.x, post.x);
    }
    return {
      start,
      posts: inWeek.length,
      ...addMetrics(byNetwork.linkedin, byNetwork.x),
      byNetwork,
    };
  });
}

/** A post's impressions across both networks. */
export const postImpressions = (post: OverviewPost): number => (post.linkedin?.impressions ?? 0) + (post.x?.impressions ?? 0);

/** Median impressions per post, or null when there are too few posts for it to mean anything. */
export function medianImpressions(posts: OverviewPost[]): number | null {
  if (posts.length < MIN_POSTS_FOR_MEDIAN) return null;
  const sorted = posts.map(postImpressions).sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The post of a week with the most impressions; the earlier one wins a tie. Null for an empty week. */
export function bestPostOf(posts: OverviewPost[], weekStart: string): OverviewPost | null {
  let best: OverviewPost | null = null;
  for (const post of posts) {
    if (post.weekStart !== weekStart) continue;
    if (!best || postImpressions(post) > postImpressions(best)) best = post;
  }
  return best;
}

/** Whole-percent change from `previous` to `current`; null when there is nothing to compare to. */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous <= 0) return null;
  return Math.round((current / previous - 1) * 100);
}

/** « 2.4 » for a post that reached 2.4× the median; null without a median. */
export function reachRatio(post: OverviewPost, median: number | null): number | null {
  if (median === null || median <= 0) return null;
  return Math.round((postImpressions(post) / median) * 10) / 10;
}

/** Views keep arriving for a few days after a post goes out: after this many days its numbers are close to final. */
export const NUMBERS_SETTLE_DAYS = 3;
const DAY_MS = 24 * 3600 * 1000;

/**
 * Whole days still to wait before the numbers of a week are close to what they will end up as: the post that
 * went out most recently decides. 0 for a week whose posts are all old enough, or with no post.
 */
export function daysUntilSettled(posts: OverviewPost[], weekStart: string, now: number): number {
  let remaining = 0;
  for (const post of posts) {
    if (post.weekStart !== weekStart) continue;
    const left = NUMBERS_SETTLE_DAYS - (now - Date.parse(post.publishedAt)) / DAY_MS;
    if (left > remaining) remaining = Math.min(left, NUMBERS_SETTLE_DAYS);
  }
  return Math.ceil(remaining);
}

export type Headline = "first" | "up" | "down" | "flat";

/** The page title's mood for the chosen week: first week of data, up, down, or unchanged. */
export function headlineOf(weeks: WeekTotals[], index: number): Headline {
  const change = index > 0 ? percentChange(weeks[index].impressions, weeks[index - 1].impressions) : null;
  if (change === null) return "first";
  return change > 0 ? "up" : change < 0 ? "down" : "flat";
}

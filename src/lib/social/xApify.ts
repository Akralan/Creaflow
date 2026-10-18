import type { PlatformPostMetric } from "./types";

/**
 * The numbers of an author's X posts read through Apify instead of the X API (docs/SPEC_PERFORMANCE.md §4):
 * a scraper actor reads the public timeline of a handle — views, likes, replies, reposts are public on X — for
 * a tenth of the price of an API read, and without the author connecting X.
 *
 * The actor is third-party and its output field names are its own: `mapApifyTweet` accepts the names the
 * common actors use. Nothing here is checked against a live run yet (spec, lot 2: try one actor on a real
 * account first) — an item it cannot read is skipped, never turned into zeros.
 */

const DEFAULT_ACTOR = "apidojo~tweet-scraper";
const MAX_ITEMS = 20;
const TIMEOUT_MS = 120_000;
/** The `integer` columns of the metrics tables top out here; a larger number from the actor is not a real count. */
const MAX_COUNT = 2_147_483_647;
/** X launched in 2006: any earlier date is a parsing accident, and a date in the future is not a post that went out. */
const EARLIEST_POST = Date.UTC(2006, 2, 1);
const MAX_ID_LENGTH = 20;

export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

/** Which provider reads the numbers of X posts: explicit `X_METRICS_PROVIDER`, else Apify when it has a token. */
export function xMetricsProvider(): "apify" | "x_api" {
  const wanted = process.env.X_METRICS_PROVIDER;
  if (wanted === "apify" || wanted === "x_api") return wanted;
  return isApifyConfigured() ? "apify" : "x_api";
}

function firstNumber(item: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.min(MAX_COUNT, Math.max(0, Math.round(value)));
    if (typeof value === "string" && /^\d{1,15}$/.test(value)) return Math.min(MAX_COUNT, Number(value));
  }
  return null;
}

function firstString(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/**
 * One scraped item → the shape the fetch pipeline uses. Null when the item is not an original post of this
 * author with a readable id (a reply, a repost, or something the actor returned for another reason).
 */
export function mapApifyTweet(item: unknown, handle: string): PlatformPostMetric | null {
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;

  const id = firstString(raw, ["id", "id_str", "tweetId", "tweet_id"]) ?? (typeof raw.id === "number" ? String(raw.id) : null);
  if (!id || id.length > MAX_ID_LENGTH || !/^\d+$/.test(id)) return null;

  // A repost of someone else's post, or a reply, is not the author's post.
  if (raw.isRetweet === true || raw.isReply === true || raw.retweeted_status) return null;
  const author = raw.author as Record<string, unknown> | undefined;
  const authorHandle =
    (author && firstString(author, ["userName", "screen_name", "username"])) ?? firstString(raw, ["userName", "username"]);
  if (authorHandle && authorHandle.toLowerCase() !== handle.toLowerCase()) return null;

  // Views are the number the screen is built on. Without them the item is skipped rather than shown as 0.
  const views = firstNumber(raw, ["viewCount", "views", "impressionCount", "impressions", "view_count"]);
  if (views === null) return null;

  const created = firstString(raw, ["createdAt", "created_at", "date"]);
  const parsed = created ? new Date(created) : undefined;
  const publishedAt = parsed && parsed.getTime() >= EARLIEST_POST && parsed.getTime() <= Date.now() + 24 * 3600_000 ? parsed : undefined;

  return {
    platformPostId: id,
    // Always our own https://x.com/ link built from the id: the actor's URL is never stored as given.
    externalUrl: `https://x.com/${handle}/status/${id}`,
    captionText: firstString(raw, ["text", "fullText", "full_text"]) ?? undefined,
    publishedAt,
    views,
    likes: firstNumber(raw, ["likeCount", "likes", "favorite_count", "favoriteCount"]) ?? 0,
    comments: firstNumber(raw, ["replyCount", "replies", "reply_count"]) ?? 0,
    shares: firstNumber(raw, ["retweetCount", "retweets", "retweet_count"]) ?? 0,
  };
}

/** The latest posts of a handle, with their public numbers. Throws on any Apify failure. */
export async function fetchXMetricsViaApify(handle: string): Promise<PlatformPostMetric[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Apify is not configured: APIFY_TOKEN is missing.");
  const actor = (process.env.APIFY_X_ACTOR || DEFAULT_ACTOR).replace("/", "~");

  const response = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      twitterHandles: [handle],
      maxItems: MAX_ITEMS,
      sort: "Latest",
      onlyTwitterBlue: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Reading X through Apify failed (${response.status}).`);
  }
  const items: unknown = await response.json();
  if (!Array.isArray(items)) throw new Error("Reading X through Apify returned an unexpected answer.");

  return items.map((item) => mapApifyTweet(item, handle)).filter((post): post is PlatformPostMetric => post !== null);
}

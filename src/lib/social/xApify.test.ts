import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchXMetricsViaApify, mapApifyTweet, xMetricsProvider } from "./xApify";

const tweet = {
  id: "1845000000000000001",
  url: "https://x.com/alix/status/1845000000000000001",
  text: "One month in public",
  createdAt: "Mon Oct 12 08:00:00 +0000 2026",
  viewCount: 1740,
  likeCount: 52,
  replyCount: 11,
  retweetCount: 14,
  author: { userName: "Alix" },
};

describe("mapApifyTweet", () => {
  it("reads the public numbers of the author's own post", () => {
    const post = mapApifyTweet(tweet, "alix");
    expect(post).toMatchObject({
      platformPostId: tweet.id,
      views: 1740,
      likes: 52,
      comments: 11,
      shares: 14,
      captionText: "One month in public",
    });
    expect(post?.publishedAt?.toISOString()).toBe("2026-10-12T08:00:00.000Z");
  });

  it("accepts the other common field names", () => {
    const post = mapApifyTweet(
      {
        id_str: "42",
        views: "900",
        favorite_count: 3,
        reply_count: 1,
        retweet_count: 2,
        full_text: "hi",
      },
      "alix"
    );
    expect(post).toMatchObject({
      platformPostId: "42",
      views: 900,
      likes: 3,
      comments: 1,
      shares: 2,
    });
    expect(post?.externalUrl).toBe("https://x.com/alix/status/42");
  });

  it("skips reposts, replies and posts by someone else", () => {
    expect(mapApifyTweet({ ...tweet, isRetweet: true }, "alix")).toBeNull();
    expect(mapApifyTweet({ ...tweet, isReply: true }, "alix")).toBeNull();
    expect(mapApifyTweet({ ...tweet, author: { userName: "someoneelse" } }, "alix")).toBeNull();
  });

  it("skips an item without views instead of reporting zero", () => {
    expect(mapApifyTweet({ ...tweet, viewCount: undefined }, "alix")).toBeNull();
  });

  it("caps a number the integer columns could not hold", () => {
    const post = mapApifyTweet({ ...tweet, viewCount: "99999999999", likeCount: 1e12 }, "alix");
    expect(post?.views).toBe(2147483647);
    expect(post?.likes).toBe(2147483647);
  });

  it("never reports a negative count", () => {
    expect(mapApifyTweet({ ...tweet, likeCount: -5 }, "alix")?.likes).toBe(0);
  });

  it("drops a publication date that cannot be real, and keeps the post", () => {
    expect(mapApifyTweet({ ...tweet, createdAt: "2" }, "alix")?.publishedAt).toBeUndefined();
    expect(mapApifyTweet({ ...tweet, createdAt: "2099-01-01T00:00:00Z" }, "alix")?.publishedAt).toBeUndefined();
  });

  it("builds the link itself instead of storing the actor's URL", () => {
    const post = mapApifyTweet({ ...tweet, url: "javascript:alert(1)" }, "alix");
    expect(post?.externalUrl).toBe(`https://x.com/alix/status/${tweet.id}`);
  });

  it("skips an id too long to be a post id", () => {
    expect(mapApifyTweet({ ...tweet, id: "1".repeat(40) }, "alix")).toBeNull();
  });

  it("skips what is not a post", () => {
    expect(mapApifyTweet(null, "alix")).toBeNull();
    expect(mapApifyTweet({ id: "not-a-number", viewCount: 5 }, "alix")).toBeNull();
    expect(mapApifyTweet({ noResults: true }, "alix")).toBeNull();
  });
});

describe("xMetricsProvider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("follows an explicit choice, else Apify when it has a token, else the API", () => {
    vi.stubEnv("APIFY_TOKEN", "");
    vi.stubEnv("X_METRICS_PROVIDER", "");
    expect(xMetricsProvider()).toBe("x_api");
    vi.stubEnv("APIFY_TOKEN", "tok");
    expect(xMetricsProvider()).toBe("apify");
    vi.stubEnv("X_METRICS_PROVIDER", "x_api");
    expect(xMetricsProvider()).toBe("x_api");
  });
});

describe("fetchXMetricsViaApify", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls the actor with the token in a header, not in the URL, and maps the items", async () => {
    vi.stubEnv("APIFY_TOKEN", "secret-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [tweet, { noResults: true }],
    });
    vi.stubGlobal("fetch", fetchMock);
    const posts = await fetchXMetricsViaApify("alix");
    expect(posts).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain("secret-token");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer secret-token",
    });
  });

  it("fails loudly without a token and on an Apify error", async () => {
    vi.stubEnv("APIFY_TOKEN", "");
    await expect(fetchXMetricsViaApify("alix")).rejects.toThrow(/APIFY_TOKEN/);
    vi.stubEnv("APIFY_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 402 }));
    await expect(fetchXMetricsViaApify("alix")).rejects.toThrow(/402/);
  });
});

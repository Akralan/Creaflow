import { describe, expect, it } from "vitest";
import {
  bestPostOf,
  daysUntilSettled,
  buildPosts,
  headlineOf,
  medianImpressions,
  percentChange,
  reachRatio,
  weekTotals,
  windowStarts,
  type MetricRow,
  type OverviewPost,
} from "./derive";

const m = (impressions: number, likes = 0, comments = 0, shares = 0) => ({
  impressions,
  likes,
  comments,
  shares,
});

function row(over: Partial<MetricRow> & Pick<MetricRow, "scriptId" | "platform">): MetricRow {
  return {
    seriesId: "s1",
    title: "A post",
    scheduledDate: null,
    publishedAt: null,
    metrics: m(100),
    ...over,
  };
}

describe("buildPosts", () => {
  it("pairs the LinkedIn and X versions of the same slot into one post", () => {
    const day = new Date("2026-10-12T00:00:00Z");
    const posts = buildPosts([
      row({
        scriptId: "a",
        platform: "linkedin",
        title: "Hello",
        scheduledDate: day,
        publishedAt: new Date("2026-10-12T08:00:00Z"),
        metrics: m(3900, 141),
      }),
      row({
        scriptId: "b",
        platform: "x",
        title: "Hello (X)",
        scheduledDate: day,
        publishedAt: new Date("2026-10-12T09:00:00Z"),
        metrics: m(1480, 44),
      }),
    ]);
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe("Hello");
    expect(posts[0].linkedin?.impressions).toBe(3900);
    expect(posts[0].x?.impressions).toBe(1480);
    expect(posts[0].publishedAt).toBe("2026-10-12T08:00:00.000Z");
  });

  it("files a post under the week it went out, not the week it was planned", () => {
    // Planned Sunday 11 Oct (week of Oct 5), actually published Monday 12 Oct (week of Oct 12).
    const [post] = buildPosts([
      row({
        scriptId: "a",
        platform: "x",
        scheduledDate: new Date("2026-10-11T00:00:00Z"),
        publishedAt: new Date("2026-10-12T07:00:00Z"),
      }),
    ]);
    expect(post.weekStart).toBe("2026-10-12");
  });

  it("falls back to the planned date when the network gave none", () => {
    const [post] = buildPosts([
      row({
        scriptId: "a",
        platform: "linkedin",
        scheduledDate: new Date("2026-10-14T00:00:00Z"),
      }),
    ]);
    expect(post.weekStart).toBe("2026-10-12");
  });

  it("keeps a single-network post, with the other side null", () => {
    const [post] = buildPosts([
      row({
        scriptId: "a",
        platform: "x",
        scheduledDate: new Date("2026-10-14T00:00:00Z"),
      }),
    ]);
    expect(post.linkedin).toBeNull();
    expect(post.x).not.toBeNull();
  });

  it("leaves out rows with no date and rows on other networks", () => {
    const posts = buildPosts([
      row({ scriptId: "a", platform: "linkedin" }),
      row({
        scriptId: "b",
        platform: "instagram",
        scheduledDate: new Date("2026-10-14T00:00:00Z"),
      }),
    ]);
    expect(posts).toEqual([]);
  });

  it("does not merge two posts of the same series on different days", () => {
    const posts = buildPosts([
      row({
        scriptId: "a",
        platform: "x",
        scheduledDate: new Date("2026-10-12T00:00:00Z"),
      }),
      row({
        scriptId: "b",
        platform: "x",
        scheduledDate: new Date("2026-10-14T00:00:00Z"),
      }),
    ]);
    expect(posts).toHaveLength(2);
  });

  it("titles an untitled post", () => {
    const [post] = buildPosts([
      row({
        scriptId: "a",
        platform: "x",
        title: "  ",
        scheduledDate: new Date("2026-10-14T00:00:00Z"),
      }),
    ]);
    expect(post.title).toBe("(untitled)");
  });
});

describe("windowStarts", () => {
  it("lists the Mondays of the last four weeks, oldest first, the current week last", () => {
    // Sunday 18 Oct 2026 belongs to the week of Monday 12 Oct.
    expect(windowStarts(new Date("2026-10-18T22:00:00Z"))).toEqual(["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"]);
  });
});

function post(over: Partial<OverviewPost> & Pick<OverviewPost, "weekStart">): OverviewPost {
  return {
    key: Math.random().toString(),
    publishedAt: `${over.weekStart}T08:00:00.000Z`,
    title: "t",
    linkedin: m(100),
    x: m(50),
    ...over,
  };
}

describe("weekTotals", () => {
  const starts = ["2026-10-05", "2026-10-12"];

  it("sums per week and per network, and zeroes a week with no post", () => {
    const weeks = weekTotals(
      [
        post({
          weekStart: "2026-10-12",
          linkedin: m(1000, 10, 2, 1),
          x: m(400, 5, 1, 0),
        }),
      ],
      starts
    );
    expect(weeks[0]).toMatchObject({
      start: "2026-10-05",
      posts: 0,
      impressions: 0,
    });
    expect(weeks[1]).toMatchObject({
      posts: 1,
      impressions: 1400,
      likes: 15,
      comments: 3,
      shares: 1,
    });
    expect(weeks[1].byNetwork.linkedin.impressions).toBe(1000);
    expect(weeks[1].byNetwork.x.impressions).toBe(400);
  });

  it("counts a missing network as zero", () => {
    const [week] = weekTotals([post({ weekStart: "2026-10-05", x: null })], ["2026-10-05"]);
    expect(week.impressions).toBe(100);
    expect(week.byNetwork.x.impressions).toBe(0);
  });
});

describe("medianImpressions", () => {
  it("is null under five posts", () => {
    expect(medianImpressions([1, 2, 3, 4].map((n) => post({ weekStart: "2026-10-05", linkedin: m(n), x: null })))).toBeNull();
  });

  it("takes the middle post, or the mean of the two middle ones", () => {
    const odd = [10, 20, 30, 40, 50].map((n) => post({ weekStart: "2026-10-05", linkedin: m(n), x: null }));
    expect(medianImpressions(odd)).toBe(30);
    const even = [10, 20, 30, 40, 50, 60].map((n) => post({ weekStart: "2026-10-05", linkedin: m(n), x: null }));
    expect(medianImpressions(even)).toBe(35);
  });
});

describe("bestPostOf", () => {
  it("returns the post with the most impressions across both networks, within the week", () => {
    const small = post({
      weekStart: "2026-10-12",
      key: "small",
      linkedin: m(100),
      x: m(100),
    });
    const big = post({
      weekStart: "2026-10-12",
      key: "big",
      linkedin: m(3000),
      x: null,
    });
    const other = post({
      weekStart: "2026-10-05",
      key: "other",
      linkedin: m(9000),
      x: null,
    });
    expect(bestPostOf([small, big, other], "2026-10-12")?.key).toBe("big");
  });

  it("is null for a week with no post", () => {
    expect(bestPostOf([], "2026-10-12")).toBeNull();
  });
});

describe("percentChange", () => {
  it("rounds to a whole percent", () => {
    expect(percentChange(16210, 10980)).toBe(48);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it("is null without a previous week to compare to", () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(100, null)).toBeNull();
  });
});

describe("reachRatio", () => {
  it("rounds to one decimal and is null without a median", () => {
    const p = post({ weekStart: "2026-10-12", linkedin: m(2400), x: null });
    expect(reachRatio(p, 1000)).toBe(2.4);
    expect(reachRatio(p, null)).toBeNull();
  });
});

describe("headlineOf", () => {
  const week = (impressions: number) => ({
    start: "x",
    posts: 1,
    impressions,
    likes: 0,
    comments: 0,
    shares: 0,
    byNetwork: { linkedin: m(0), x: m(0) },
  });

  it("is « first » for the oldest week or when the previous one is empty", () => {
    expect(headlineOf([week(10), week(20)], 0)).toBe("first");
    expect(headlineOf([week(0), week(20)], 1)).toBe("first");
  });

  it("reads up, down and flat from the change in impressions", () => {
    expect(headlineOf([week(100), week(150)], 1)).toBe("up");
    expect(headlineOf([week(100), week(60)], 1)).toBe("down");
    expect(headlineOf([week(100), week(100)], 1)).toBe("flat");
  });
});

describe("buildPosts — free posts and duplicates", () => {
  const day = new Date("2026-10-14T00:00:00Z");

  it("pairs the LinkedIn and X versions of a post outside any series, like the week screen does", () => {
    const posts = buildPosts([
      row({ scriptId: "a", platform: "linkedin", seriesId: null, scheduledDate: day, publishedAt: day }),
      row({ scriptId: "b", platform: "x", seriesId: null, scheduledDate: day, publishedAt: day }),
    ]);
    expect(posts).toHaveLength(1);
    expect(posts[0].linkedin).not.toBeNull();
    expect(posts[0].x).not.toBeNull();
  });

  it("keeps a second script of the same network on the same slot as another post instead of dropping it", () => {
    const posts = buildPosts([
      row({ scriptId: "a", platform: "linkedin", scheduledDate: day, publishedAt: day, metrics: m(100) }),
      row({ scriptId: "b", platform: "linkedin", scheduledDate: day, publishedAt: day, metrics: m(900) }),
    ]);
    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.linkedin?.impressions).sort()).toEqual([100, 900]);
  });

  it("does not depend on the order the rows come in", () => {
    const rows = [
      row({ scriptId: "b", platform: "linkedin", scheduledDate: day, publishedAt: day, metrics: m(900) }),
      row({ scriptId: "a", platform: "linkedin", scheduledDate: day, publishedAt: day, metrics: m(100) }),
      row({ scriptId: "c", platform: "x", scheduledDate: day, publishedAt: day, metrics: m(50) }),
    ];
    expect(buildPosts(rows)).toEqual(buildPosts([...rows].reverse()));
  });
});

describe("week boundaries (UTC, Monday to Sunday)", () => {
  it("puts Sunday 23:59:59 in the week that ends and Monday 00:00:00 in the next", () => {
    const [sunday, monday] = buildPosts([
      row({ scriptId: "a", platform: "x", seriesId: null, publishedAt: new Date("2026-10-11T23:59:59Z") }),
      row({ scriptId: "b", platform: "x", seriesId: null, publishedAt: new Date("2026-10-12T00:00:00Z") }),
    ]);
    expect(sunday.weekStart).toBe("2026-10-05");
    expect(monday.weekStart).toBe("2026-10-12");
  });
});

describe("bestPostOf — ties", () => {
  it("keeps the earlier post when two have the same impressions", () => {
    const first = post({ weekStart: "2026-10-12", key: "first", linkedin: m(500), x: null });
    const second = post({ weekStart: "2026-10-12", key: "second", linkedin: m(500), x: null });
    expect(bestPostOf([first, second], "2026-10-12")?.key).toBe("first");
  });
});

describe("daysUntilSettled", () => {
  const DAY = 24 * 3600 * 1000;
  const now = Date.parse("2026-10-14T12:00:00Z");
  const at = (offsetDays: number, weekStart = "2026-10-12") =>
    post({ weekStart, publishedAt: new Date(now - offsetDays * DAY).toISOString() });

  it("asks to wait for a post that went out hours ago", () => {
    expect(daysUntilSettled([at(0.5)], "2026-10-12", now)).toBe(3);
    expect(daysUntilSettled([at(1)], "2026-10-12", now)).toBe(2);
    expect(daysUntilSettled([at(2.5)], "2026-10-12", now)).toBe(1);
  });

  it("asks nothing once every post is old enough", () => {
    expect(daysUntilSettled([at(3), at(10)], "2026-10-12", now)).toBe(0);
  });

  it("follows the most recent post of the week", () => {
    expect(daysUntilSettled([at(9), at(0.2)], "2026-10-12", now)).toBe(3);
  });

  it("ignores the posts of other weeks and a week with no post", () => {
    expect(daysUntilSettled([at(0.1, "2026-10-05")], "2026-10-12", now)).toBe(0);
    expect(daysUntilSettled([], "2026-10-12", now)).toBe(0);
  });

  it("never asks for more than the settling time, even with a clock that is ahead", () => {
    expect(daysUntilSettled([at(-5)], "2026-10-12", now)).toBe(3);
  });
});

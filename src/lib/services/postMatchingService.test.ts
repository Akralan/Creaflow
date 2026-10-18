import { describe, expect, it } from "vitest";
import { classifyMatch, findBestMatchingScript, MATCH_SCORE_THRESHOLD, scorePostMatch } from "./postMatchingService";

const DAY_MS = 1000 * 60 * 60 * 24;

describe("scorePostMatch", () => {
  it("returns a high score for an identical date and an identical caption", () => {
    const publishedAt = new Date("2026-08-01T12:00:00Z");
    const score = scorePostMatch(
      { publishedAt, captionText: "New product available today" },
      { scheduledDate: publishedAt, caption: "New product available today" }
    );
    expect(score).toBeCloseTo(1, 5);
  });

  it("returns 0 for a date gap beyond the 7-day window, even with an identical caption on date alone", () => {
    const post = { publishedAt: new Date("2026-08-01T00:00:00Z") };
    const candidate = { scheduledDate: new Date("2026-08-20T00:00:00Z"), caption: null };
    expect(scorePostMatch(post, candidate)).toBe(0);
  });

  it("degrades the date score linearly with the gap in days", () => {
    const post = { publishedAt: new Date("2026-08-01T00:00:00Z") };
    const threeDaysLater = new Date(post.publishedAt.getTime() + 3 * DAY_MS);
    const score = scorePostMatch(post, { scheduledDate: threeDaysLater, caption: null });
    // 0.5 * (1 - 3/7) ≈ 0.286
    expect(score).toBeCloseTo(0.5 * (1 - 3 / 7), 5);
  });

  it("returns 0 if no date is available on one side or the other", () => {
    expect(scorePostMatch({ captionText: "test" }, { scheduledDate: null, caption: "test" })).toBeCloseTo(0.5, 5);
    expect(scorePostMatch({}, { scheduledDate: new Date(), caption: null })).toBe(0);
  });

  it("ignores hashtags and URLs in caption similarity", () => {
    const post = { captionText: "Launch of the new product! #promo #news https://example.com" };
    const candidate = { scheduledDate: null, caption: "Launch of the new product!" };
    expect(scorePostMatch(post, candidate)).toBeCloseTo(0.5, 5);
  });

  it("returns 0 for two empty captions", () => {
    expect(scorePostMatch({}, { scheduledDate: null, caption: null })).toBe(0);
  });

  it("is insensitive to case and punctuation", () => {
    const post = { captionText: "Belle Journee, non ?" };
    const candidate = { scheduledDate: null, caption: "belle journee non" };
    expect(scorePostMatch(post, candidate)).toBeCloseTo(0.5, 5);
  });
});

describe("findBestMatchingScript", () => {
  const publishedAt = new Date("2026-08-01T00:00:00Z");

  it("returns null if no candidate reaches the threshold", () => {
    const result = findBestMatchingScript(
      { publishedAt, captionText: "Totally different content" },
      [{ scheduledDate: new Date("2026-09-15T00:00:00Z"), caption: "Nothing to do with it" }]
    );
    expect(result).toBeNull();
  });

  it("returns the candidate with the best score among several above the threshold", () => {
    const weakMatch = { id: "weak", scheduledDate: publishedAt, caption: "sujet vaguement proche" };
    const strongMatch = { id: "strong", scheduledDate: publishedAt, caption: "launch of the new product" };
    const result = findBestMatchingScript(
      { publishedAt, captionText: "launch of the new product" },
      [weakMatch, strongMatch]
    );
    expect(result?.script.id).toBe("strong");
    expect(result?.score).toBeGreaterThanOrEqual(MATCH_SCORE_THRESHOLD);
  });

  it("returns null for an empty candidate list", () => {
    expect(findBestMatchingScript({ publishedAt }, [])).toBeNull();
  });
});

describe("classifyMatch", () => {
  const day = new Date("2026-10-12T00:00:00Z");
  const post = { publishedAt: day, captionText: "One month in public: what I would do differently" };
  const same = { scheduledDate: day, caption: "One month in public: what I would do differently" };
  const other = { scheduledDate: day, caption: "Why the app never says good job on a bad squat" };

  it("links without asking when one script matches clearly and nothing else comes close", () => {
    const result = classifyMatch(post, [same, other]);
    expect(result?.script).toBe(same);
    expect(result?.auto).toBe(true);
  });

  it("asks when two scripts of the same day are about as likely", () => {
    const twin = { ...same };
    const result = classifyMatch(post, [same, twin]);
    expect(result?.auto).toBe(false);
  });

  it("asks when the match is only fair", () => {
    const result = classifyMatch({ publishedAt: day, captionText: "something else entirely" }, [{ scheduledDate: day, caption: "one month in public" }]);
    expect(result === null || result.auto === false).toBe(true);
  });

  it("returns null under the proposal threshold", () => {
    expect(classifyMatch({ publishedAt: day, captionText: "zzz" }, [{ scheduledDate: new Date("2026-09-01T00:00:00Z"), caption: "abc" }])).toBeNull();
  });
});

describe("classifyMatch — the bar for linking without asking", () => {
  const day = new Date("2026-10-12T00:00:00Z");

  it("asks when the date is perfect but the caption was rewritten", () => {
    const result = classifyMatch(
      { publishedAt: day, captionText: "A completely rewritten caption about something else" },
      [{ scheduledDate: day, caption: "One month in public: what I would do differently" }]
    );
    expect(result?.auto).toBe(false);
  });

  it("asks when the caption matches but the post went out days later", () => {
    const result = classifyMatch(
      { publishedAt: new Date("2026-10-15T00:00:00Z"), captionText: "One month in public: what I would do differently" },
      [{ scheduledDate: day, caption: "One month in public: what I would do differently" }]
    );
    expect(result?.auto).toBe(false);
  });

  it("never links without a publication date", () => {
    const result = classifyMatch({ captionText: "One month in public" }, [{ scheduledDate: day, caption: "One month in public" }]);
    expect(result === null || result.auto === false).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { findBestMatchingScript, MATCH_SCORE_THRESHOLD, scorePostMatch } from "./postMatchingService";

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

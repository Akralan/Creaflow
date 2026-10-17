import { describe, expect, it } from "vitest";
import { annotateUsedSpans, findBestMatchInText, mergeIntervals, splitIntoSentences } from "./citationMatching";

describe("splitIntoSentences", () => {
  it("splits on sentence boundaries, keeping the original position", () => {
    const text = "First point. Second point! Third?";
    const sentences = splitIntoSentences(text);
    expect(sentences.map((s) => s.text)).toEqual(["First point.", "Second point!", "Third?"]);
    for (const s of sentences) {
      expect(text.slice(s.start, s.start + s.text.length)).toBe(s.text);
    }
  });

  it("returns an empty array for an empty text", () => {
    expect(splitIntoSentences("")).toEqual([]);
  });
});

describe("findBestMatchInText", () => {
  const source = "We decided to prioritise combat before navigation. Movement is less natural than expected.";

  it("finds an exact quote (fast path)", () => {
    const match = findBestMatchInText("prioritise combat before navigation", source);
    expect(match).not.toBeNull();
    expect(match!.score).toBe(1);
    expect(source.slice(match!.start, match!.start + match!.length).toLowerCase()).toContain("prioritise combat");
  });

  it("tolerates a light rewording through word overlap", () => {
    const match = findBestMatchInText("movement less natural than expected", source);
    expect(match).not.toBeNull();
  });

  it("returns null if nothing matches", () => {
    expect(findBestMatchInText("cooking recipe for a chocolate cake", source)).toBeNull();
  });

  it("returns null for an empty excerpt", () => {
    expect(findBestMatchInText("", source)).toBeNull();
    expect(findBestMatchInText("   ", source)).toBeNull();
  });
});

describe("mergeIntervals", () => {
  it("merges overlapping intervals", () => {
    expect(mergeIntervals([{ start: 0, length: 10 }, { start: 5, length: 10 }])).toEqual([{ start: 0, length: 15 }]);
  });

  it("merges intervals that touch exactly", () => {
    expect(mergeIntervals([{ start: 0, length: 5 }, { start: 5, length: 5 }])).toEqual([{ start: 0, length: 10 }]);
  });

  it("does not merge disjoint intervals", () => {
    expect(mergeIntervals([{ start: 0, length: 5 }, { start: 20, length: 5 }])).toEqual([
      { start: 0, length: 5 },
      { start: 20, length: 5 },
    ]);
  });

  it("sorts before merging, input order irrelevant", () => {
    expect(mergeIntervals([{ start: 20, length: 5 }, { start: 0, length: 5 }])).toEqual([
      { start: 0, length: 5 },
      { start: 20, length: 5 },
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(mergeIntervals([])).toEqual([]);
  });
});

describe("annotateUsedSpans", () => {
  const text = "Hello world, this is a test text.";

  it("returns the text unchanged with no zones to annotate", () => {
    expect(annotateUsedSpans(text, [])).toBe(text);
  });

  it("wraps a quoted zone in markers without removing text", () => {
    const result = annotateUsedSpans(text, [{ start: 6, length: 6 }]); // "world,"
    expect(result).toContain("[already used in a previous post]world,[/already used]");
    expect(result.replace(/\[.*?\]/g, "")).toBe(text);
  });

  it("merges overlapping zones before annotating (no nested markers)", () => {
    const result = annotateUsedSpans(text, [
      { start: 0, length: 10 },
      { start: 5, length: 10 },
    ]);
    expect(result.match(/\[already used in a previous post\]/g)?.length).toBe(1);
  });

  it("ignores out-of-bounds intervals without crashing", () => {
    expect(() => annotateUsedSpans(text, [{ start: -5, length: 3 }, { start: 1000, length: 3 }])).not.toThrow();
  });
});

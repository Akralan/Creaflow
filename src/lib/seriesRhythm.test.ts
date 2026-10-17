import { describe, expect, it } from "vitest";
import { datesForRhythm, distributeDays, parseStoredRhythm, rhythmLabel, suggestDays } from "./seriesRhythm";

const d = (month: number, day: number) => new Date(Date.UTC(2026, month - 1, day));

describe("datesForRhythm", () => {
  it("gives the requested days of the week, bounds included", () => {
    const dates = datesForRhythm({ days: [3, 6], every: 1, anchor: null }, d(10, 21), d(10, 31));
    expect(dates.map((x) => x.getUTCDate())).toEqual([21, 24, 28, 31]);
  });

  it("every other week, starting from the anchor's week (before as well as after)", () => {
    const rhythm = { days: [4], every: 2 as const, anchor: "2026-10-26" };
    expect(datesForRhythm(rhythm, d(10, 12), d(11, 15)).map((x) => `${x.getUTCMonth() + 1}/${x.getUTCDate()}`)).toEqual(["10/15", "10/29", "11/12"]);
  });
});

describe("parseStoredRhythm", () => {
  it("sorts and deduplicates the days, rejects every other week without an anchor", () => {
    expect(parseStoredRhythm({ days: [6, 3, 3], every: 1, anchor: null })?.days).toEqual([3, 6]);
    expect(parseStoredRhythm({ days: [3], every: 2, anchor: null })).toBeNull();
    expect(parseStoredRhythm(null)).toBeNull();
  });
});

describe("rhythmLabel", () => {
  it("writes the rhythm in plain words", () => {
    expect(rhythmLabel({ days: [3, 6], every: 1, anchor: null })).toBe("Wed and Sat");
    expect(rhythmLabel({ days: [4], every: 2, anchor: "2026-10-26" })).toBe("Thu, every other week");
    expect(rhythmLabel(null)).toBe("No rhythm");
  });
});

describe("distributeDays / suggestDays", () => {
  it("spreads the days from heaviest to lightest, shares the first day otherwise", () => {
    expect(distributeDays([3, 6], 1)).toEqual([[3, 6]]);
    expect(distributeDays([3, 6], 2)).toEqual([[3], [6]]);
    expect(distributeDays([3, 6], 3)).toEqual([[3], [6], [3]]);
  });

  it("pre-checks the free days, otherwise the first possible day", () => {
    expect(suggestDays([3, 6], [3])).toEqual([6]);
    expect(suggestDays([3, 6], [3, 6])).toEqual([3]);
  });
});

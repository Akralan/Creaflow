import { describe, expect, it } from "vitest";
import { datesForRhythm, distributeDays, parseStoredRhythm, rhythmLabel, suggestDays } from "./seriesRhythm";

const d = (month: number, day: number) => new Date(Date.UTC(2026, month - 1, day));

describe("datesForRhythm", () => {
  it("donne les jours de la semaine demandés, bornes comprises", () => {
    const dates = datesForRhythm({ days: [3, 6], every: 1, anchor: null }, d(10, 21), d(10, 31));
    expect(dates.map((x) => x.getUTCDate())).toEqual([21, 24, 28, 31]);
  });

  it("une semaine sur deux, à partir de la semaine de l'ancre (avant comme après)", () => {
    const rhythm = { days: [4], every: 2 as const, anchor: "2026-10-26" };
    expect(datesForRhythm(rhythm, d(10, 12), d(11, 15)).map((x) => `${x.getUTCMonth() + 1}/${x.getUTCDate()}`)).toEqual(["10/15", "10/29", "11/12"]);
  });
});

describe("parseStoredRhythm", () => {
  it("trie et dédoublonne les jours, refuse une semaine sur deux sans ancre", () => {
    expect(parseStoredRhythm({ days: [6, 3, 3], every: 1, anchor: null })?.days).toEqual([3, 6]);
    expect(parseStoredRhythm({ days: [3], every: 2, anchor: null })).toBeNull();
    expect(parseStoredRhythm(null)).toBeNull();
  });
});

describe("rhythmLabel", () => {
  it("écrit le rythme en clair", () => {
    expect(rhythmLabel({ days: [3, 6], every: 1, anchor: null })).toBe("Mer. et sam.");
    expect(rhythmLabel({ days: [4], every: 2, anchor: "2026-10-26" })).toBe("Jeu., une semaine sur deux");
    expect(rhythmLabel(null)).toBe("Pas de rythme");
  });
});

describe("distributeDays / suggestDays", () => {
  it("répartit les jours de la plus lourde à la plus légère, partage le premier jour sinon", () => {
    expect(distributeDays([3, 6], 1)).toEqual([[3, 6]]);
    expect(distributeDays([3, 6], 2)).toEqual([[3], [6]]);
    expect(distributeDays([3, 6], 3)).toEqual([[3], [6], [3]]);
  });

  it("précoche les jours libres, sinon le premier jour possible", () => {
    expect(suggestDays([3, 6], [3])).toEqual([6]);
    expect(suggestDays([3, 6], [3, 6])).toEqual([3]);
  });
});

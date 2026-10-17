import { describe, expect, it } from "vitest";
import { filterByPlatform, parseMonth, planSeriesSlots, publishingDaysLabel } from "./calendarService";

describe("publishingDaysLabel", () => {
  it("écrit les jours en clair, dans l'ordre de la semaine", () => {
    expect(publishingDaysLabel([6, 3])).toBe("mercredi, samedi");
  });

  it("ignore les doublons et les valeurs hors de 1..7", () => {
    expect(publishingDaysLabel([7, 7, 0, 8, 1])).toBe("lundi, dimanche");
  });
});

describe("parseMonth", () => {
  it("calcule le bon nombre de jours pour un mois de 31 jours", () => {
    expect(parseMonth("2026-08")).toEqual({ year: 2026, monthIndex: 7, daysInMonth: 31 });
  });

  it("calcule le bon nombre de jours pour février hors année bissextile", () => {
    expect(parseMonth("2026-02").daysInMonth).toBe(28);
  });

  it("calcule le bon nombre de jours pour février en année bissextile", () => {
    expect(parseMonth("2024-02").daysInMonth).toBe(29);
  });
});

describe("filterByPlatform", () => {
  it("inclut un élément sans plateforme assignée, quelle que soit la plateforme demandée", () => {
    const items = [{ id: "a", platforms: [] }];
    expect(filterByPlatform(items, "instagram")).toEqual(items);
    expect(filterByPlatform(items, "slack")).toEqual(items);
  });

  it("inclut un élément seulement si ses plateformes contiennent la plateforme demandée", () => {
    const items = [
      { id: "a", platforms: ["linkedin"] },
      { id: "b", platforms: ["slack"] },
    ];
    expect(filterByPlatform(items, "linkedin")).toEqual([items[0]]);
    expect(filterByPlatform(items, "slack")).toEqual([items[1]]);
    expect(filterByPlatform(items, "instagram")).toEqual([]);
  });
});

describe("planSeriesSlots (docs/SPEC_RYTHME_DES_SERIES.md §3)", () => {
  const d = (day: number) => new Date(Date.UTC(2026, 9, day)); // octobre 2026 : le 21 est un mercredi
  const series = { id: "s1", rhythm: { days: [3, 6], every: 1 as const, anchor: null }, platforms: [] };

  it("crée les jours du rythme sur chaque réseau actif, sans doublon de l'existant", () => {
    const { toCreate, toDelete } = planSeriesSlots({
      series,
      activePlatforms: ["linkedin", "x"],
      existing: [{ id: "e1", seriesId: "s1", platform: "linkedin", scheduledDate: d(21), locked: false }],
      from: d(19),
      to: d(25),
    });
    expect(toCreate.map((c) => `${c.scheduledDate.getUTCDate()}-${c.platform}`)).toEqual(["21-x", "24-linkedin", "24-x"]);
    expect(toDelete).toEqual([]);
  });

  it("supprime les créneaux vides hors rythme, jamais un créneau verrouillé ni celui d'une autre série", () => {
    const { toDelete } = planSeriesSlots({
      series,
      activePlatforms: ["linkedin"],
      existing: [
        { id: "vide-jeudi", seriesId: "s1", platform: "linkedin", scheduledDate: d(22), locked: false },
        { id: "redige-jeudi", seriesId: "s1", platform: "linkedin", scheduledDate: d(22), locked: true },
        { id: "autre-serie", seriesId: "s2", platform: "linkedin", scheduledDate: d(22), locked: false },
        { id: "reseau-coupe", seriesId: "s1", platform: "x", scheduledDate: d(21), locked: false },
      ],
      from: d(19),
      to: d(25),
    });
    expect(toDelete).toEqual(["vide-jeudi", "reseau-coupe"]);
  });

  it("respecte les réseaux ciblés et ne crée rien sans rythme", () => {
    const targeted = planSeriesSlots({ series: { ...series, platforms: ["x"] }, activePlatforms: ["linkedin", "x"], existing: [], from: d(19), to: d(25) });
    expect(targeted.toCreate.every((c) => c.platform === "x")).toBe(true);
    expect(planSeriesSlots({ series: { ...series, rhythm: null }, activePlatforms: ["linkedin"], existing: [], from: d(19), to: d(25) }).toCreate).toEqual([]);
  });
});

describe("planSeriesSlots — créneaux retirés à la main", () => {
  it("ne recrée pas un créneau retiré, et supprime un vide qui y serait encore", () => {
    const d = (day: number) => new Date(Date.UTC(2026, 9, day));
    const { toCreate, toDelete } = planSeriesSlots({
      series: { id: "s1", rhythm: { days: [3, 6], every: 1, anchor: null }, platforms: [], skippedSlots: ["2026-10-24|linkedin"] },
      activePlatforms: ["linkedin"],
      existing: [{ id: "reste", seriesId: "s1", platform: "linkedin", scheduledDate: d(24), locked: false }],
      from: d(19),
      to: d(25),
    });
    expect(toCreate.map((c) => c.scheduledDate.getUTCDate())).toEqual([21]);
    expect(toDelete).toEqual(["reste"]);
  });
});

describe("planSeriesSlots — au-delà de l'horizon", () => {
  it("supprime un vide hors rythme posé plus loin par l'ancien calendrier, sans rien créer après l'horizon", () => {
    const d = (day: number) => new Date(Date.UTC(2026, 10, day)); // novembre 2026 : le 18 est un mercredi
    const { toCreate, toDelete } = planSeriesSlots({
      series: { id: "s1", rhythm: { days: [6], every: 1, anchor: null }, platforms: [] },
      activePlatforms: ["linkedin"],
      existing: [
        { id: "mercredi-loin", seriesId: "s1", platform: "linkedin", scheduledDate: d(18), locked: false },
        { id: "samedi-loin", seriesId: "s1", platform: "linkedin", scheduledDate: d(21), locked: false },
      ],
      from: d(2),
      to: d(8),
    });
    expect(toDelete).toEqual(["mercredi-loin"]);
    expect(toCreate.map((c) => c.scheduledDate.getUTCDate())).toEqual([7]);
  });
});

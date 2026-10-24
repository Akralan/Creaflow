import { describe, expect, it } from "vitest";

import { keepOldestTrigger, openEventsFor, type GenreEventRow } from "./eventGenres";

const row = (over: Partial<GenreEventRow> & Pick<GenreEventRow, "id" | "genre">): GenreEventRow => ({
  date: "2026-01-01",
  line: 1,
  sourceMaterialId: "d",
  heldBy: false,
  ...over,
});

describe("openEventsFor", () => {
  const texts = new Map([["d", ["l1", "l2", "l3", "l4", "l5"]]]);

  it("garde les engagements et annonces non tenus et toutes les décisions, écarte le reste", () => {
    const open = openEventsFor(
      [
        row({ id: "a", genre: "engagement", line: 1, heldBy: true }),
        row({ id: "b", genre: "annonce", line: 2, date: "2026-02-01" }),
        row({ id: "c", genre: "décision", line: 3, date: "2026-03-01", heldBy: true }),
        row({ id: "d", genre: "livraison", line: 4, date: "2026-03-02" }),
        row({ id: "e", genre: "engagement", line: 5, date: "2026-01-15" }),
      ],
      texts
    );
    expect(open.map((o) => o.id)).toEqual(["c", "b", "e"]);
    expect(open[1]).toEqual({ id: "b", genre: "annonce", date: "2026-02-01", text: "l2" });
  });

  it("plafonne aux plus récents", () => {
    const open = openEventsFor(
      [row({ id: "x", genre: "décision", line: 1, date: "2026-01-01" }), row({ id: "y", genre: "décision", line: 2, date: "2026-05-01" })],
      texts,
      1
    );
    expect(open.map((o) => o.id)).toEqual(["y"]);
  });

  it("écarte un événement dont la ligne est introuvable", () => {
    expect(openEventsFor([row({ id: "x", genre: "engagement", line: 99 })], texts)).toEqual([]);
    expect(openEventsFor([row({ id: "x", genre: "engagement", sourceMaterialId: "absent" })], texts)).toEqual([]);
  });
});

describe("keepOldestTrigger", () => {
  it("garde le plus ancien déclencheur et rend les autres", () => {
    const ids = keepOldestTrigger([
      { id: "x", genre: "déclencheur", date: "2026-05-01", createdAt: new Date(1) },
      { id: "y", genre: "déclencheur", date: "2025-01-01", createdAt: new Date(2) },
      { id: "z", genre: "déclencheur", date: null, createdAt: new Date(0) },
      { id: "w", genre: "livraison", date: "2024-01-01", createdAt: new Date(0) },
    ]);
    expect(ids.sort()).toEqual(["x", "z"]);
  });

  it("sans date, départage par l'ordre d'enregistrement", () => {
    expect(
      keepOldestTrigger([
        { id: "a", genre: "déclencheur", date: null, createdAt: new Date(5) },
        { id: "b", genre: "déclencheur", date: null, createdAt: new Date(1) },
      ])
    ).toEqual(["a"]);
  });

  it("rien à faire avec zéro ou un déclencheur", () => {
    expect(keepOldestTrigger([])).toEqual([]);
    expect(keepOldestTrigger([{ id: "a", genre: "déclencheur", date: null, createdAt: new Date() }])).toEqual([]);
  });
});

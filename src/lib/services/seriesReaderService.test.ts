import { describe, expect, it } from "vitest";

import { pointerTimeline, restrictToLocked, toldPointerIds, type PointerRow } from "./seriesReaderService";

const row = (over: Partial<PointerRow> = {}): PointerRow => ({
  id: "e1",
  line: 42,
  date: "2026-10-21",
  sourceMaterialId: "doc-1",
  documentTitle: "docs/DEVLOG.md",
  ...over,
});

describe("pointerTimeline", () => {
  it("rend une adresse par pointeur", () => {
    expect(pointerTimeline([row()], new Set(), new Set(["doc-1"]))).toEqual([
      { id: "e1", file: "docs/DEVLOG.md", line: 42, date: "2026-10-21", used: false },
    ]);
  });

  it("écarte un pointeur dont le document a disparu", () => {
    expect(pointerTimeline([row({ sourceMaterialId: "parti" })], new Set(), new Set(["doc-1"]))).toEqual([]);
  });

  it("écarte un pointeur dont le document n'a pas de titre : son adresse serait inouvrable", () => {
    expect(pointerTimeline([row({ documentTitle: null })], new Set(), new Set(["doc-1"]))).toEqual([]);
  });

  it("marque used un pointeur déjà servi par un post de la série", () => {
    const [entry] = pointerTimeline([row()], new Set(["e1"]), new Set(["doc-1"]));
    expect(entry.used).toBe(true);
  });

  it("ne filtre plus par lecteur : tous les pointeurs du sujet sont là", () => {
    const pointers = [row({ id: "e1" }), row({ id: "e2", date: null }), row({ id: "e3", line: 7 })];
    expect(pointerTimeline(pointers, new Set(), new Set(["doc-1"]))).toHaveLength(3);
  });
});

describe("restrictToLocked", () => {
  const timeline = pointerTimeline(
    [row({ id: "e1" }), row({ id: "e2", line: 7 }), row({ id: "e3", line: 9 })],
    new Set(),
    new Set(["doc-1"])
  );

  it("rend la ligne de temps entière quand rien n'est verrouillé", () => {
    expect(restrictToLocked(timeline, [])).toHaveLength(3);
  });

  it("ne garde que les pointeurs verrouillés : la version X raconte ce que LinkedIn a raconté", () => {
    expect(restrictToLocked(timeline, ["e2"]).map((e) => e.id)).toEqual(["e2"]);
  });

  it("garde l'ordre du verrou, pas celui de la ligne de temps", () => {
    expect(restrictToLocked(timeline, ["e3", "e1"]).map((e) => e.id)).toEqual(["e3", "e1"]);
  });

  it("ignore un id verrouillé absent de la ligne de temps", () => {
    expect(restrictToLocked(timeline, ["parti", "e1"]).map((e) => e.id)).toEqual(["e1"]);
  });

  it("rend la ligne de temps entière si AUCUN id verrouillé n'existe plus : mieux vaut un post que rien", () => {
    expect(restrictToLocked(timeline, ["parti"])).toHaveLength(3);
  });
});

describe("toldPointerIds", () => {
  it("prend tous les pointeurs du tableau eventIds", () => {
    expect(toldPointerIds([{ eventIds: ["a", "b"], eventId: "a" }])).toEqual(new Set(["a", "b"]));
  });

  it("retombe sur eventId pour un post d'avant le chantier", () => {
    expect(toldPointerIds([{ eventIds: [], eventId: "vieux" }])).toEqual(new Set(["vieux"]));
  });

  it("ignore un eventIds qui n'est pas un tableau de chaînes", () => {
    expect(toldPointerIds([{ eventIds: { a: 1 }, eventId: null }, { eventIds: [3, "ok"], eventId: null }])).toEqual(new Set(["ok"]));
  });
});

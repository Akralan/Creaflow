import { describe, expect, it } from "vitest";

import { pointerTimeline, toldPointerIds, type PointerRow } from "./seriesReaderService";

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

import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
}));

import { extractPointers, numberAndSplit } from "./pointerExtractor";

beforeEach(() => {
  callStructuredMock.mockReset();
});

describe("numberAndSplit", () => {
  it("numérote à partir de 1 et garde les numéros du document complet", () => {
    const parts = numberAndSplit("a\nb\nc", 8);
    expect(parts[0]).toContain("1\ta");
    expect(parts.at(-1)).toContain("3\tc");
  });

  it("rend une part pour un document vide", () => {
    expect(numberAndSplit("")).toHaveLength(1);
  });

  it("ne coupe jamais au milieu d'une ligne", () => {
    for (const part of numberAndSplit("aaaa\nbbbb\ncccc", 10)) {
      for (const line of part.split("\n")) {
        expect(line).toMatch(/^\d+\t/);
      }
    }
  });
});

describe("extractPointers", () => {
  it("écarte une ligne qui n'existe pas dans le document", async () => {
    callStructuredMock.mockResolvedValue({ events: [{ line: 999, date: "2026-10-21" }] });

    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });

    expect(pointers).toEqual([]);
  });

  it("ramène une date non ISO à null", async () => {
    callStructuredMock.mockResolvedValue({ events: [{ line: 1, date: "hier" }, { line: 2, date: "" }] });

    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });

    expect(pointers).toEqual([
      { file: "d.md", line: 1, date: null },
      { file: "d.md", line: 2, date: null },
    ]);
  });

  it("garde une date ISO telle quelle", async () => {
    callStructuredMock.mockResolvedValue({ events: [{ line: 2, date: " 2026-10-21 " }] });

    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });

    expect(pointers).toEqual([{ file: "d.md", line: 2, date: "2026-10-21" }]);
  });

  it("ne garde qu'un pointeur quand le même numéro de ligne revient deux fois", async () => {
    callStructuredMock.mockResolvedValue({
      events: [{ line: 2, date: "2026-10-21" }, { line: 2, date: "2026-10-22" }],
    });

    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });

    expect(pointers).toEqual([{ file: "d.md", line: 2, date: "2026-10-21" }]);
  });

  it("lit un document vide en un appel et ne rend aucun pointeur", async () => {
    callStructuredMock.mockResolvedValue({ events: [] });

    const { pointers, calls } = await extractPointers({ file: "vide.md", text: "" });

    expect(calls).toBe(1);
    expect(pointers).toEqual([]);
  });
});

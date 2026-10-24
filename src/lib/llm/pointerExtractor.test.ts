import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
}));

import { buildExtractorSystemPrompt, buildExtractorTool, extractPointers, numberAndSplit, type OpenEvent } from "./pointerExtractor";
import { GENRES } from "./postForms";

beforeEach(() => {
  callStructuredMock.mockReset();
});

/** Une entrée du modèle avec les champs de genre par défaut. */
const ev = (line: number, date = "", over: Partial<{ genre: string; available: boolean; fulfills: string }> = {}) => ({
  line,
  date,
  genre: "livraison",
  available: false,
  fulfills: "",
  ...over,
});

const base = { genre: "livraison", disponible: false, tient: null };

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

describe("extractPointers — l'adresse", () => {
  it("écarte une ligne qui n'existe pas dans le document", async () => {
    callStructuredMock.mockResolvedValue({ events: [ev(999, "2026-10-21")] });
    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });
    expect(pointers).toEqual([]);
  });

  it("ramène une date non ISO à null", async () => {
    callStructuredMock.mockResolvedValue({ events: [ev(1, "hier"), ev(2, "")] });
    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });
    expect(pointers).toEqual([
      { file: "d.md", line: 1, date: null, ...base },
      { file: "d.md", line: 2, date: null, ...base },
    ]);
  });

  it("garde une date ISO telle quelle", async () => {
    callStructuredMock.mockResolvedValue({ events: [ev(2, " 2026-10-21 ")] });
    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });
    expect(pointers).toEqual([{ file: "d.md", line: 2, date: "2026-10-21", ...base }]);
  });

  it("ne garde qu'un pointeur quand le même numéro de ligne revient deux fois", async () => {
    callStructuredMock.mockResolvedValue({ events: [ev(2, "2026-10-21"), ev(2, "2026-10-22")] });
    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });
    expect(pointers).toEqual([{ file: "d.md", line: 2, date: "2026-10-21", ...base }]);
  });

  it("lit un document vide en un appel et ne rend aucun pointeur", async () => {
    callStructuredMock.mockResolvedValue({ events: [] });
    const { pointers, calls } = await extractPointers({ file: "vide.md", text: "" });
    expect(calls).toBe(1);
    expect(pointers).toEqual([]);
  });
});

describe("extractPointers — le genre", () => {
  it("pose le genre, et ramène un genre inconnu ou absent à livraison", async () => {
    callStructuredMock.mockResolvedValue({
      events: [ev(1, "2026-10-01", { genre: "échec" }), ev(2, "", { genre: "truc" }), { line: 3, date: "" }],
    });
    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb\nc" });
    expect(pointers.map((p) => p.genre)).toEqual(["échec", "livraison", "livraison"]);
  });

  it("ramène un engagement sans chiffre dans la ligne à décision", async () => {
    callStructuredMock.mockResolvedValue({ events: [ev(1, "", { genre: "engagement" })] });
    const { pointers } = await extractPointers({ file: "d.md", text: "On va faire mieux." });
    expect(pointers[0].genre).toBe("décision");
  });

  it("garde un engagement qui porte un nombre ou une date", async () => {
    callStructuredMock.mockResolvedValue({ events: [ev(1, "", { genre: "engagement" })] });
    const { pointers } = await extractPointers({ file: "d.md", text: "1 M de vues d'ici le 31 décembre." });
    expect(pointers[0].genre).toBe("engagement");
  });

  it("available n'est gardé que sur une livraison", async () => {
    callStructuredMock.mockResolvedValue({
      events: [ev(1, "", { genre: "livraison", available: true }), ev(2, "", { genre: "chiffre", available: true })],
    });
    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb" });
    expect(pointers.map((p) => p.disponible)).toEqual([true, false]);
  });

  it("tient : seulement vers un id de la liste ouverte, sinon null", async () => {
    callStructuredMock.mockResolvedValue({
      events: [ev(1, "", { available: true, fulfills: "e-open" }), ev(2, "", { fulfills: "e-unknown" })],
    });
    const open: OpenEvent[] = [{ id: "e-open", genre: "annonce", date: "2026-09-01", text: "dispo le 3 novembre" }];
    const { pointers } = await extractPointers({ file: "d.md", text: "a\nb" }, open);
    expect(pointers.map((p) => p.tient)).toEqual(["e-open", null]);
    expect(pointers[0].disponible).toBe(true);
  });

  it("le message utilisateur porte la liste ouverte quand il y en a une, et rien sinon", async () => {
    callStructuredMock.mockResolvedValue({ events: [] });
    await extractPointers({ file: "d.md", text: "a" }, [{ id: "e1", genre: "engagement", date: "2026-09-01", text: "100 clients avant Noël" }]);
    expect(callStructuredMock.mock.calls[0][0].userMessage).toContain("<open>");
    expect(callStructuredMock.mock.calls[0][0].userMessage).toContain("[e1] engagement · 2026-09-01 · 100 clients avant Noël");
    await extractPointers({ file: "d.md", text: "a" });
    expect(callStructuredMock.mock.calls[1][0].userMessage).not.toContain("<open>");
  });

  it("l'outil exige le genre parmi les treize et le prompt nomme chaque genre", () => {
    const tool = buildExtractorTool();
    const items = (tool.input_schema as unknown as { properties: { events: { items: { properties: { genre: { enum: string[] } }; required: string[] } } } }).properties
      .events.items;
    expect(items.properties.genre.enum).toEqual([...GENRES]);
    expect(items.required).toEqual(["line", "date", "genre", "available", "fulfills"]);
    const prompt = buildExtractorSystemPrompt();
    for (const g of GENRES) expect(prompt).toContain(`- ${g} —`);
  });
});

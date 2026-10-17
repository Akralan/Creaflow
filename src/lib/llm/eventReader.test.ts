import { describe, expect, it } from "vitest";
import {
  buildEventReaderTools,
  excerptIsInDocument,
  maxTurnsForParts,
  normalizeEventDate,
  saveEventInputSchema,
  splitDocumentIntoParts,
} from "./eventReader";

describe("normalizeEventDate", () => {
  it("garde le jour tel quel en précision day", () => {
    expect(normalizeEventDate("2026-03-07", "day")).toEqual({ date: "2026-03-07", datePrecision: "day" });
  });

  it("ramène au 1er du mois en précision month", () => {
    expect(normalizeEventDate("2026-03-14", "month")).toEqual({ date: "2026-03-01", datePrecision: "month" });
  });

  it("efface la date en précision unknown, quoi que le modèle envoie", () => {
    expect(normalizeEventDate("n'importe quoi", "unknown")).toEqual({ date: null, datePrecision: "unknown" });
  });

  it("refuse une date mal formée ou impossible, pour que le modèle corrige", () => {
    expect(() => normalizeEventDate("mars 2026", "day")).toThrow(/AAAA-MM-JJ/);
    expect(() => normalizeEventDate("2026-02-30", "day")).toThrow(/impossible/);
  });
});

describe("excerptIsInDocument", () => {
  const doc = "Marion s’est mise de profil.\nElle a arrêté au bout de 40 secondes : « je ne peux pas donner ça à un patient ».";

  it("retrouve un passage copié tel quel", () => {
    expect(excerptIsInDocument("Elle a arrêté au bout de 40 secondes", doc)).toBe(true);
  });

  it("tolère les apostrophes, guillemets et espaces différents", () => {
    expect(excerptIsInDocument("Marion s'est mise de profil. Elle a arrêté", doc)).toBe(true);
    expect(excerptIsInDocument('"je ne peux pas donner ça à un patient"', doc)).toBe(true);
  });

  it("refuse un passage reformulé", () => {
    expect(excerptIsInDocument("Marion a stoppé la démo après 40 s", doc)).toBe(false);
  });
});

describe("splitDocumentIntoParts", () => {
  it("rend un petit document en une seule partie", () => {
    expect(splitDocumentIntoParts("court", 100)).toEqual(["court"]);
  });

  it("coupe de préférence à une fin de ligne et ne perd rien", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `ligne ${i} ${"x".repeat(20)}`);
    const text = lines.join("\n");
    const parts = splitDocumentIntoParts(text, 300);
    expect(parts.join("")).toBe(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts.slice(0, -1)) expect(part.endsWith("\n")).toBe(true);
  });
});

describe("maxTurnsForParts", () => {
  it("croît avec le nombre de parties et reste borné", () => {
    expect(maxTurnsForParts(1)).toBe(16);
    expect(maxTurnsForParts(10)).toBe(52);
    expect(maxTurnsForParts(1000)).toBe(160);
  });
});

describe("saveEventInputSchema", () => {
  it("accepte ce que le modèle est censé envoyer", () => {
    const parsed = saveEventInputSchema.safeParse({
      date: "2026-03-07",
      datePrecision: "day",
      title: "Marion arrête la démo au bout de 40 secondes",
      whatHappened: "De profil, le squelette saute sur le genou.",
      whatChanged: "",
      kind: "feedback",
      audiences: ["Kinés du sport"],
      sourceMaterialId: "doc-1",
      excerpt: "Elle a arrêté au bout de 40 secondes",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuse un type d'événement inconnu", () => {
    const parsed = saveEventInputSchema.safeParse({
      date: "",
      datePrecision: "unknown",
      title: "x",
      whatHappened: "y",
      whatChanged: "",
      kind: "anecdote",
      audiences: [],
      sourceMaterialId: "doc-1",
      excerpt: "z",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("buildEventReaderTools", () => {
  it("restreint les publics à ceux du portrait quand il existe", () => {
    const tools = buildEventReaderTools({ audienceLabels: ["Kinés du sport", "Devs santé"] });
    const save = tools.find((t) => t.name === "save_event")!;
    const audiences = save.input_schema.properties.audiences as { items: { enum?: string[] } };
    expect(audiences.items.enum).toEqual(["Kinés du sport", "Devs santé"]);
  });

  it("laisse les publics libres mais vides sans portrait", () => {
    const tools = buildEventReaderTools({ audienceLabels: [] });
    const save = tools.find((t) => t.name === "save_event")!;
    const audiences = save.input_schema.properties.audiences as { items: { enum?: string[] } };
    expect(audiences.items.enum).toBeUndefined();
  });
});

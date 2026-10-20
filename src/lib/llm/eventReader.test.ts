import { describe, expect, it } from "vitest";
import {
  buildEventReaderTools,
  datedEntryCount,
  excerptIsInDocument,
  maxTurnsForReading,
  narrativeFirst,
  normalizeEventDate,
  saveEventInputSchema,
  splitDocumentIntoParts,
} from "./eventReader";

describe("normalizeEventDate", () => {
  it("keeps the day as is at day precision", () => {
    expect(normalizeEventDate("2026-03-07", "day")).toEqual({ date: "2026-03-07", datePrecision: "day" });
  });

  it("brings it back to the 1st of the month at month precision", () => {
    expect(normalizeEventDate("2026-03-14", "month")).toEqual({ date: "2026-03-01", datePrecision: "month" });
  });

  it("clears the date at unknown precision, whatever the model sends", () => {
    expect(normalizeEventDate("anything at all", "unknown")).toEqual({ date: null, datePrecision: "unknown" });
  });

  it("rejects a malformed or impossible date, so the model corrects it", () => {
    expect(() => normalizeEventDate("mars 2026", "day")).toThrow(/YYYY-MM-DD/);
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

const doc = (id: string, rawText: string) => ({ id, title: id, rawText });

describe("datedEntryCount", () => {
  it("compte les titres datés d'un journal", () => {
    expect(datedEntryCount("## 2025-11-09\nJulien dit…\n## 2025-11-16\nPrototype.")).toBe(2);
  });

  it("ne compte pas deux fois la même date", () => {
    expect(datedEntryCount("## 2025-11-09\nx\n## 2025-11-09\ny")).toBe(1);
  });

  it("rend 0 sur une page de documentation sans date", () => {
    expect(datedEntryCount("# Architecture\nFastAPI, PostgreSQL 16, SQLAlchemy.")).toBe(0);
  });
});

describe("narrativeFirst", () => {
  it("met le journal daté avant la documentation", () => {
    const docs = [doc("a", "# Architecture\nFastAPI."), doc("b", "## 2025-11-09\nJulien dit…\n## 2025-11-16\nPrototype.")];
    expect(narrativeFirst(docs).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("classe les journaux entre eux par densité de dates décroissante", () => {
    const peu = doc("peu", "## 2026-01-01\nx\n## 2026-01-02\ny");
    const beaucoup = doc("beaucoup", Array.from({ length: 11 }, (_, i) => `## 2026-02-${String(i + 1).padStart(2, "0")}\nx`).join("\n"));
    expect(narrativeFirst([peu, beaucoup]).map((x) => x.id)).toEqual(["beaucoup", "peu"]);
  });

  it("garde l'ordre d'origine entre deux documents sans date", () => {
    const docs = [doc("x", "# A"), doc("y", "# B"), doc("z", "# C")];
    expect(narrativeFirst(docs).map((d) => d.id)).toEqual(["x", "y", "z"]);
  });
});

describe("maxTurnsForReading", () => {
  it("laisse de la place aux enregistrements, pas seulement aux lectures", () => {
    expect(maxTurnsForReading({ parts: 5, expectedEvents: 13 })).toBeGreaterThanOrEqual(34);
  });

  it("reproduit le cas réel qui avait été coupé", () => {
    // 5 documents, 13 entrées datées : il avait fallu 33 tours, l'ancien plafond en donnait 32.
    expect(maxTurnsForReading({ parts: 5, expectedEvents: 13 })).toBeGreaterThan(32);
  });

  it("reste plafonné pour ne pas partir en boucle", () => {
    expect(maxTurnsForReading({ parts: 500, expectedEvents: 500 })).toBeLessThanOrEqual(240);
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

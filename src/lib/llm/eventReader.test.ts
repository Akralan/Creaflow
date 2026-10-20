import { describe, expect, it } from "vitest";
import {
  buildEventReaderSystemPrompt,
  buildEventReaderTools,
  buildEventReaderUserMessage,
  COMPLETE_EVENT_TOOL,
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

describe("prompt du lecteur d'événements", () => {
  const ctx = () => ({
    brandName: "Alix",
    subjectName: "MyKiné",
    subjectDescription: "Le patient fait ses exercices devant la caméra de son téléphone.",
    audiences: [
      {
        label: "Kinés du sport",
        who: "des kinés libéraux en cabinet",
        wants: "savoir ce que font leurs patients entre deux séances",
        stopsFor: "un patient qui tient trois semaines",
        turnsOff: "le vocabulaire technique",
        words: ["séance", "amplitude"],
      },
    ],
    unreadDocuments: 2,
    alreadyReadDocuments: 0,
    existingEvents: [],
  });

  it("donne le portrait complet de chaque public, pas seulement son étiquette", () => {
    const msg = buildEventReaderUserMessage(ctx());
    expect(msg).toContain("Comes looking for: savoir ce que font leurs patients");
    expect(msg).toContain("Turned off by: le vocabulaire technique");
    expect(msg).toContain("Their words: séance, amplitude");
  });

  it("autorise explicitement un document technique à rendre des événements", () => {
    expect(buildEventReaderSystemPrompt(ctx())).toContain("A technical document can perfectly well contain events");
  });

  it("pose la bonne question : ce fait change-t-il quelque chose pour quelqu'un", () => {
    expect(buildEventReaderSystemPrompt(ctx())).toContain("does this fact change something for someone");
  });

  it("dit que compléter vaut mieux qu'écarter un doublon", () => {
    expect(buildEventReaderSystemPrompt(ctx())).toContain(COMPLETE_EVENT_TOOL);
  });
});

describe("saveEventInputSchema — angles par public", () => {
  const base = {
    date: "2026-03-07",
    datePrecision: "day" as const,
    title: "Marion arrête la démo au bout de 40 secondes",
    whatHappened: "De profil, le squelette saute sur le genou.",
    whatChanged: "",
    kind: "feedback" as const,
    sourceMaterialId: "doc-1",
    excerpt: "Elle a arrêté au bout de 40 secondes",
  };

  it("accepte des angles par public", () => {
    const parsed = saveEventInputSchema.safeParse({ ...base, audienceAngles: [{ audience: "Kinés du sport", whatItChanges: "de trois quarts face, le genou reste visible" }] });
    expect(parsed.success).toBe(true);
  });

  it("accepte une liste d'angles vide : « personne » est une réponse normale", () => {
    expect(saveEventInputSchema.safeParse({ ...base, audienceAngles: [] }).success).toBe(true);
  });

  it("refuse un angle sans texte", () => {
    expect(saveEventInputSchema.safeParse({ ...base, audienceAngles: [{ audience: "Kinés du sport", whatItChanges: "" }] }).success).toBe(false);
  });
});

describe("outils du lecteur", () => {
  it("expose complete_event avec l'id de l'événement à compléter", () => {
    const tools = buildEventReaderTools({ audienceLabels: ["Kinés du sport"] });
    expect(tools.map((t) => t.name)).toContain(COMPLETE_EVENT_TOOL);
    const complete = tools.find((t) => t.name === COMPLETE_EVENT_TOOL)!;
    expect(complete.input_schema.required).toContain("id");
  });

  it("borne les publics des angles à ceux du portrait", () => {
    const tools = buildEventReaderTools({ audienceLabels: ["Kinés du sport"] });
    const save = tools.find((t) => t.name === "save_event")!;
    const angles = save.input_schema.properties.audienceAngles as { items: { properties: { audience: { enum?: string[] } } } };
    expect(angles.items.properties.audience.enum).toEqual(["Kinés du sport"]);
  });
});

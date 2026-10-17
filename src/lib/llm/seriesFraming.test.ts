import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { buildOptionsMessage, FRAMING_CATALOG, FRAMING_DIMENSIONS, parseStoredFraming, proposeFramingOptions, type FramingContext } from "./seriesFraming";
import { buildFramingBlock, buildScriptUserMessage, SCRIPT_CORE_PROMPT } from "./prompts";

const context: FramingContext = {
  subjectName: "Creaflow",
  subjectDescription: "Outil de posts",
  series: { label: "CreaFlow en chantier", description: "Le devlog", mode: "feuilleton", roleLabel: "Coulisses" },
  readers: [{ label: "Devs", who: "Développeurs d'outils IA" }],
  moment: { title: "Cinq briefs rejoués", documents: [{ title: "Journal", text: "J'ai rejoué 5 briefs." }] },
};

const framing = {
  moment: { title: "Cinq briefs rejoués", docIds: ["d1"] },
  posture: { id: "labo", label: "Le carnet de labo", rule: "Protocole, mesure.", sample: "J'ai rejoué 5 briefs." },
  voice: null,
  story: { id: "fin", label: "Par la fin", rule: "Ouvre sur le résultat.", sample: "4 sur 5 passaient." },
  signature: { text: "Labo n°{n}", placement: "titre" as const },
  rejected: [{ dimension: "posture" as const, id: "position", label: "La prise de position", sample: "Juger à l'œil, c'est se mentir." }],
  remarks: [],
  completedAt: null,
};

beforeEach(() => callStructuredMock.mockReset());

describe("catalogue", () => {
  it("a 6 options par dimension, aux ids uniques, chacune avec sa règle", () => {
    for (const d of FRAMING_DIMENSIONS) {
      expect(FRAMING_CATALOG[d]).toHaveLength(6);
      expect(new Set(FRAMING_CATALOG[d].map((o) => o.id)).size).toBe(6);
      expect(FRAMING_CATALOG[d].every((o) => o.rule && o.description)).toBe(true);
    }
  });
});

describe("buildOptionsMessage", () => {
  it("donne le moment, la matière, les choix déjà faits et la remarque", () => {
    const message = buildOptionsMessage({
      context,
      dimension: "story",
      candidates: FRAMING_CATALOG.story,
      chosen: { posture: framing.posture },
      remark: "plus court",
    });
    expect(message).toContain("Dimension à choisir : récit");
    expect(message).toContain("- Posture : Le carnet de labo — Protocole, mesure.");
    expect(message).toContain("Remarque de l'auteur : plus court");
    expect(message).toContain("[Journal]\nJ'ai rejoué 5 briefs.");
  });
  it("le dit quand il n'y a pas de matière", () => {
    expect(buildOptionsMessage({ context: { ...context, moment: { title: "x", documents: [] } }, dimension: "posture", candidates: FRAMING_CATALOG.posture, chosen: {} })).toContain(
      "Matière : aucune pour l'instant"
    );
  });
});

describe("proposeFramingOptions", () => {
  it("garde 3 options du catalogue, sans doublon, en excluant celles déjà vues", async () => {
    callStructuredMock.mockResolvedValue({
      options: [
        { id: "labo", sample: "A" },
        { id: "labo", sample: "B" },
        { id: "inventee", sample: "C" },
        { id: "guide", sample: "D" },
        { id: "compagnon", sample: "E" },
      ],
    });
    const options = await proposeFramingOptions({ context, dimension: "posture", chosen: {}, excludeIds: ["coulisses"] });
    expect(options.map((o) => o.id)).toEqual(["labo", "guide", "compagnon"]);
    const tool = callStructuredMock.mock.calls[0][0].tool;
    expect(tool.input_schema.properties.options.items.properties.id.enum).not.toContain("coulisses");
    expect(callStructuredMock.mock.calls[0][0].strict).toBe(true);
  });
});

describe("cadrage dans la génération (docs/SPEC_CADRAGE_SERIE.md §4)", () => {
  const base = {
    creatorProfile: { brandName: "A", activityType: "B" },
    platform: "linkedin",
    contentCategory: { id: "c", label: "Coulisses", description: "d" },
    contentType: "text" as const,
    angle: { id: "a", label: "Itération", description: "En direct" },
  };

  it("rend <cadrage> avec posture, récit, signature, extraits choisis et écartés", () => {
    const block = buildFramingBlock(parseStoredFraming(framing));
    expect(block).toContain("- Posture : Le carnet de labo — Protocole, mesure.");
    expect(block).toContain("- Signature (titre) : Labo n°{n}");
    expect(block).toContain("« 4 sur 5 passaient. »");
    expect(block).toContain("Extraits qu'il a écartés (à ne pas imiter) :\n« Juger à l'œil, c'est se mentir. »");
    expect(buildFramingBlock(null)).toBe("");
  });

  it("met la voix choisie dans <style>, réduit l'angle à l'accroche, et place <cadrage> après <style>", () => {
    const message = buildScriptUserMessage({
      ...base,
      framing: parseStoredFraming(framing),
      chosenVoice: { id: "sobre", label: "Sobre et précise", rule: "Phrases courtes.", sample: "Court.", chosenAt: null },
    });
    expect(message).toContain("<style>\nVoix choisie par l'auteur : Sobre et précise — Phrases courtes. Exemple qu'il a préféré : « Court. »");
    expect(message.indexOf("<cadrage>")).toBeGreaterThan(message.indexOf("<style>"));
    expect(message).toContain("Angle (forme de l'accroche seulement, la structure vient du récit choisi) : Itération — En direct");
  });

  it("la voix de la série prime sur celle du compte ; sans cadrage, l'angle garde la structure", () => {
    const message = buildScriptUserMessage({
      ...base,
      framing: parseStoredFraming({ ...framing, voice: { id: "pairs", label: "Entre pairs", rule: "Jargon.", sample: "" } }),
      chosenVoice: { id: "sobre", label: "Sobre et précise", rule: "Phrases courtes.", sample: "", chosenAt: null },
    });
    expect(message).toContain("Voix choisie par l'auteur : Entre pairs — Jargon.");
    expect(message).not.toContain("Sobre et précise");
    expect(buildScriptUserMessage(base)).toContain("Angle (forme de l'accroche et de la structure)");
    expect(SCRIPT_CORE_PROMPT).toContain("cadrage choisi");
  });
});

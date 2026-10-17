import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock, callWebResearchMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn(), callWebResearchMock: vi.fn() }));
vi.mock("./provider", () => ({ callStructured: callStructuredMock, callWebResearch: callWebResearchMock }));

import { buildResearchMessage, filterFoundInspirations, normalizeUrl, researchInspirations, type InspirationResearchContext } from "./inspirationResearch";
import { buildInspirationBlock, buildScriptUserMessage, SCRIPT_SYSTEM_PROMPT } from "./prompts";
import { generateScript } from "./generateScript";

const ctx: InspirationResearchContext = {
  subjectName: "Mira",
  subjectDescription: "Jeu de plateforme",
  readers: [{ label: "Joueurs", who: "Fans de plateformes 2D", wants: "Voir le jeu" }],
  targetAudience: null,
  platforms: ["x"],
  existingUrls: ["https://example.com/deja"],
  dismissed: [{ url: "https://example.com/ecartee", reason: "Trop générique" }],
};

const item = (url: string, overrides = {}) => ({ url, title: "Titre", insight: "Des GIF avant/après.", kind: "format" as const, readerLabel: "Joueurs", platform: "x", ...overrides });

beforeEach(() => {
  callStructuredMock.mockReset();
  callWebResearchMock.mockReset();
});

describe("normalizeUrl", () => {
  it("ignore protocole, www, ancre, barre finale et paramètres utm", () => {
    expect(normalizeUrl("https://www.Example.com/post/1/?utm_source=x#top")).toBe(normalizeUrl("http://example.com/post/1"));
    expect(normalizeUrl("https://example.com/a?id=2")).not.toBe(normalizeUrl("https://example.com/a?id=3"));
  });
});

describe("buildResearchMessage", () => {
  it("donne les publics, les plateformes et ce qui est déjà connu", () => {
    const message = buildResearchMessage(ctx);
    expect(message).toContain("- Joueurs : Fans de plateformes 2D. Vient chercher : Voir le jeu.");
    expect(message).toContain("Déjà en fiche (ne les repropose pas) : https://example.com/deja");
    expect(message).toContain("https://example.com/ecartee — Trop générique");
  });
  it("retombe sur le « Pour qui » sans portrait", () => {
    expect(buildResearchMessage({ ...ctx, readers: [], targetAudience: "Les joueurs" })).toContain("Pour qui : Les joueurs");
  });
});

describe("filterFoundInspirations", () => {
  const options = { sources: ["https://a.com/1", "https://b.com/2", "https://example.com/deja"], knownUrls: ["https://example.com/deja"], readerLabels: ["Joueurs"], platforms: ["x", "linkedin"] };

  it("écarte les liens non consultés, déjà connus ou en double", () => {
    const kept = filterFoundInspirations([item("https://a.com/1"), item("https://a.com/1/"), item("https://inventé.com"), item("https://example.com/deja")], options);
    expect(kept.map((k) => k.url)).toEqual(["https://a.com/1"]);
  });

  it("ramène à null un public ou une plateforme hors liste", () => {
    const [kept] = filterFoundInspirations([item("https://b.com/2", { readerLabel: "Inconnu", platform: "tiktok" })], options);
    expect(kept).toMatchObject({ readerLabel: null, platform: null });
  });
});

describe("researchInspirations", () => {
  it("ne garde que les fiches dont le lien a été consulté", async () => {
    callWebResearchMock.mockResolvedValue({ text: "Compte rendu", sources: [{ url: "https://a.com/1", title: "A" }] });
    callStructuredMock.mockResolvedValue({ items: [item("https://a.com/1"), item("https://halluciné.com/2")] });
    const found = await researchInspirations(ctx, ["x"]);
    expect(found.map((f) => f.url)).toEqual(["https://a.com/1"]);
    expect(callStructuredMock.mock.calls[0][0].userMessage).toContain("=== PAGES CONSULTÉES ===\n- https://a.com/1 (A)");
  });

  it("ne met rien en fiche quand la recherche n'a consulté aucune page", async () => {
    callWebResearchMock.mockResolvedValue({ text: "Rien de probant.", sources: [] });
    expect(await researchInspirations(ctx, ["x"])).toEqual([]);
    expect(callStructuredMock).not.toHaveBeenCalled();
  });
});

describe("inspiration dans la génération (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3)", () => {
  const cards = [{ ref: "i1", id: "uuid-1", url: "https://a.com/1", insight: "Des GIF avant/après.", kind: "format", readerLabel: "Joueurs", platform: "x" }];
  const base = {
    creatorProfile: { brandName: "A", activityType: "B" },
    platform: "x",
    contentCategory: { id: "c", label: "Coulisses", description: "d" },
    contentType: "text" as const,
  };

  it("rend le bloc <inspiration> après <brief>, et rien sans fiche", () => {
    expect(buildInspirationBlock([])).toBe("");
    expect(buildInspirationBlock(cards)).toContain("- [i1] (Joueurs · x · format) Des GIF avant/après. — https://a.com/1");
    const message = buildScriptUserMessage({ ...base, inspirations: cards });
    expect(message.indexOf("<inspiration>")).toBeGreaterThan(message.indexOf("<brief>"));
    expect(message.indexOf("<inspiration>")).toBeLessThan(message.indexOf("<plateforme>"));
    expect(SCRIPT_SYSTEM_PROMPT).toContain("5 bis. inspirationsUsed et inspirationsToDrop");
  });

  it("garde dans la trace les fiches montrées et les retours du rédacteur", async () => {
    callStructuredMock.mockResolvedValue({
      concept: "c",
      title: "t",
      hookText: "Accroche courte.",
      caption: "Texte court sur X.",
      hashtags: [],
      reader: { label: "Joueurs", knows: "", wants: "" },
      candidateMoments: [],
      chosenMoment: { index: 0, why: "" },
      hookOptions: [{ kind: "scène", text: "" }],
      chosenHook: { index: 0, why: "" },
      inspirationsUsed: ["i1"],
      inspirationsToDrop: [],
      selfCheck: { factsFromMaterial: true, bannedPhrasesFound: [], readerTest: "Oui.", authorTest: true },
    });
    const result = await generateScript({ ...base, inspirations: cards });
    expect(result.trace).toMatchObject({ inspirationsShown: [{ ref: "i1", id: "uuid-1" }], inspirationsUsed: ["i1"], inspirationsToDrop: [] });
  });
});

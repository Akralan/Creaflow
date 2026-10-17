import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock, callWebResearchMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn(), callWebResearchMock: vi.fn() }));
vi.mock("./provider", () => ({ callStructured: callStructuredMock, callWebResearch: callWebResearchMock }));

import { buildResearchMessage, filterFoundInspirations, normalizeUrl, researchInspirations, type InspirationResearchContext } from "./inspirationResearch";
import { buildInspirationBlock, buildScriptUserMessage, SCRIPT_SYSTEM_PROMPT } from "./prompts";
import { generateScript } from "./generateScript";

const ctx: InspirationResearchContext = {
  subjectName: "Mira",
  subjectDescription: "Platformer game",
  readers: [{ label: "Players", who: "2D platformer fans", wants: "See the game" }],
  targetAudience: null,
  platforms: ["x"],
  existingUrls: ["https://example.com/deja"],
  dismissed: [{ url: "https://example.com/ecartee", reason: "Too generic" }],
};

const item = (url: string, overrides = {}) => ({ url, title: "Title", insight: "Before/after GIFs.", kind: "format" as const, readerLabel: "Players", platform: "x", ...overrides });

beforeEach(() => {
  callStructuredMock.mockReset();
  callWebResearchMock.mockReset();
});

describe("normalizeUrl", () => {
  it("ignores protocol, www, anchor, trailing slash and utm parameters", () => {
    expect(normalizeUrl("https://www.Example.com/post/1/?utm_source=x#top")).toBe(normalizeUrl("http://example.com/post/1"));
    expect(normalizeUrl("https://example.com/a?id=2")).not.toBe(normalizeUrl("https://example.com/a?id=3"));
  });
});

describe("buildResearchMessage", () => {
  it("gives the audiences, the platforms and what is already known", () => {
    const message = buildResearchMessage(ctx);
    expect(message).toContain("- Players: 2D platformer fans. Comes looking for: See the game.");
    expect(message).toContain("Already carded (don't propose them again): https://example.com/deja");
    expect(message).toContain("https://example.com/ecartee — Too generic");
  });
  it("falls back on Who-for without a portrait", () => {
    expect(buildResearchMessage({ ...ctx, readers: [], targetAudience: "The players" })).toContain("Who for: The players");
  });
});

describe("filterFoundInspirations", () => {
  const options = { sources: ["https://a.com/1", "https://b.com/2", "https://example.com/deja"], knownUrls: ["https://example.com/deja"], readerLabels: ["Players"], platforms: ["x", "linkedin"] };

  it("drops links that were not consulted, already known or duplicated", () => {
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
    callWebResearchMock.mockResolvedValue({ text: "Report", sources: [{ url: "https://a.com/1", title: "A" }] });
    callStructuredMock.mockResolvedValue({ items: [item("https://a.com/1"), item("https://halluciné.com/2")] });
    const found = await researchInspirations(ctx, ["x"]);
    expect(found.map((f) => f.url)).toEqual(["https://a.com/1"]);
    expect(callStructuredMock.mock.calls[0][0].userMessage).toContain("=== PAGES CONSULTED ===\n- https://a.com/1 (A)");
  });

  it("ne met rien en fiche quand la recherche n'a consulté aucune page", async () => {
    callWebResearchMock.mockResolvedValue({ text: "Nothing conclusive.", sources: [] });
    expect(await researchInspirations(ctx, ["x"])).toEqual([]);
    expect(callStructuredMock).not.toHaveBeenCalled();
  });
});

describe("inspiration dans la génération (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3)", () => {
  const cards = [{ ref: "i1", id: "uuid-1", url: "https://a.com/1", insight: "Before/after GIFs.", kind: "format", readerLabel: "Players", platform: "x" }];
  const base = {
    creatorProfile: { brandName: "A", activityType: "B" },
    platform: "x",
    contentCategory: { id: "c", label: "Behind the scenes", description: "d" },
    contentType: "text" as const,
  };

  it("rend le bloc <inspiration> après <brief>, et rien sans fiche", () => {
    expect(buildInspirationBlock([])).toBe("");
    expect(buildInspirationBlock(cards)).toContain("- [i1] (Players · x · format) Before/after GIFs. — https://a.com/1");
    const message = buildScriptUserMessage({ ...base, inspirations: cards });
    expect(message.indexOf("<inspiration>")).toBeGreaterThan(message.indexOf("<brief>"));
    expect(message.indexOf("<inspiration>")).toBeLessThan(message.indexOf("<platform>"));
    expect(SCRIPT_SYSTEM_PROMPT).toContain("5 bis. inspirationsUsed and inspirationsToDrop");
  });

  it("garde dans la trace les fiches montrées et les retours du rédacteur", async () => {
    callStructuredMock.mockResolvedValue({
      concept: "c",
      title: "t",
      hookText: "Short hook.",
      caption: "Short text on X.",
      hashtags: [],
      reader: { label: "Players", knows: "", wants: "" },
      candidateMoments: [],
      chosenMoment: { index: 0, why: "" },
      hookOptions: [{ kind: "scene", text: "" }],
      chosenHook: { index: 0, why: "" },
      inspirationsUsed: ["i1"],
      inspirationsToDrop: [],
      selfCheck: { factsFromMaterial: true, bannedPhrasesFound: [], readerTest: "Yes.", authorTest: true },
    });
    const result = await generateScript({ ...base, inspirations: cards });
    expect(result.trace).toMatchObject({ inspirationsShown: [{ ref: "i1", id: "uuid-1" }], inspirationsUsed: ["i1"], inspirationsToDrop: [] });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
}));

import { generateScript } from "./generateScript";
import {
  GENERATE_VISUAL_POST_TOOL_NAME,
  GENERATE_TEXT_POST_TOOL_NAME,
} from "./scriptSchema";
import type { ScriptGenerationContext } from "./prompts";

const baseContext = {
  creatorProfile: {
    brandName: "Bougies Test",
    activityType: "Artisan bougies",
  },
  platform: "linkedin",
  contentCategory: { id: "cat-1", label: "Sales", description: "Sales-oriented content." },
};

const textContext: ScriptGenerationContext = { ...baseContext, contentType: "text" };

const validTextInput = {
  concept: "Single idea of the post, who it addresses, what they should remember.",
  title: "Titre",
  hookText: "Texte",
  caption: "Caption",
  hashtags: ["#test"],
};

beforeEach(() => {
  callStructuredMock.mockReset();
});

describe("generateScript", () => {
  it("renvoie le script structuré renvoyé par le provider, avec le contentType attaché", async () => {
    callStructuredMock.mockResolvedValue(validTextInput);

    const result = await generateScript(textContext);
    expect(result).toEqual({ contentType: "text", ...validTextInput, usedExcerpts: [], promisesMade: [] });
  });

  it("propage l'erreur si le provider ne renvoie pas de réponse structurée", async () => {
    callStructuredMock.mockRejectedValue(new Error("The model did not return a structured response."));
    await expect(generateScript(textContext)).rejects.toThrow("did not return a structured response");
  });

  it("lève une erreur si le contenu renvoyé ne respecte pas le schéma attendu", async () => {
    callStructuredMock.mockResolvedValue({ title: "Incomplet" });
    await expect(generateScript(textContext)).rejects.toThrow();
  });

  it("appelle le provider avec l'outil generate_visual_post pour un contentType visual", async () => {
    callStructuredMock.mockResolvedValue({
      concept: "Single idea of the post.",
      title: "Titre",
      hookVisual: "Visuel",
      storyboard: [{ planNumber: 1, description: "Slide 1" }],
      caption: "Caption",
      hashtags: ["#test"],
    });
    await generateScript({ ...baseContext, contentType: "visual" });
    expect(callStructuredMock).toHaveBeenCalledWith(
      expect.objectContaining({ tool: expect.objectContaining({ name: GENERATE_VISUAL_POST_TOOL_NAME }) })
    );
  });

  it("appelle le provider avec l'outil generate_text_post pour un contentType text", async () => {
    callStructuredMock.mockResolvedValue({
      concept: "Single idea of the post.",
      title: "Titre",
      hookText: "Accroche",
      caption: "Texte complet",
      hashtags: [],
    });
    const result = await generateScript({ ...baseContext, contentType: "text" });
    expect(result).toEqual({
      contentType: "text",
      concept: "Single idea of the post.",
      title: "Titre",
      hookText: "Accroche",
      caption: "Texte complet",
      hashtags: [],
      usedExcerpts: [],
      promisesMade: [],
    });
    expect(callStructuredMock).toHaveBeenCalledWith(
      expect.objectContaining({ tool: expect.objectContaining({ name: GENERATE_TEXT_POST_TOOL_NAME }) })
    );
  });
});

describe("bloc STYLE (docs/SPEC_APPRENTISSAGE_STYLE.md §5.4)", () => {
  const styleProfile = {
    tone: "direct",
    sentenceLength: "short",
    emojiUsage: "none",
    vocabulary: "plain",
    summary: "Direct, no emoji.",
    rules: [
      { text: "Never any emoji.", platform: null },
      { text: "No hashtag in the body.", platform: "x" },
    ],
    avoid: ["discover"],
    prefer: [],
    evidence: { scriptCount: 3, learnedAt: null },
  };

  it("injecte la voix et les règles de la plateforme cible dans le message", async () => {
    callStructuredMock.mockResolvedValue(validTextInput);
    await generateScript({ ...textContext, styleProfile });
    const userMessage: string = callStructuredMock.mock.calls[0][0].userMessage;
    expect(userMessage).toContain("<style>\nVoice: Direct, no emoji.");
    expect(userMessage).toContain("- Never any emoji.");
    expect(userMessage).not.toContain("No hashtag in the body.");
    expect(userMessage).toContain("Avoid: discover");
  });

  it("n'émet aucun bloc STYLE sans profil", async () => {
    callStructuredMock.mockResolvedValue(validTextInput);
    await generateScript(textContext);
    const userMessage: string = callStructuredMock.mock.calls[0][0].userMessage;
    expect(userMessage).not.toContain("<style>");
  });
});

describe("format du post visuel (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §5.1)", () => {
  const visualInput = (n: number) => ({
    concept: "Idea",
    title: "Titre",
    hookVisual: "Visuel",
    storyboard: Array.from({ length: n }, (_, i) => ({ planNumber: i + 1, description: `Slide ${i + 1}` })),
    // Assez long pour passer le contrôle de longueur LinkedIn (docs/SPEC_PROMPT_GENERATION_V3.md §5).
    caption: "Detailed caption. ".repeat(40),
    hashtags: ["#test"],
  });
  const visualContext: ScriptGenerationContext = {
    ...baseContext,
    contentType: "visual",
    visual: { format: "carousel", slideCount: 3, durationMs: null },
  };

  it("injecte le bloc FORMAT et accepte un storyboard conforme en un appel", async () => {
    callStructuredMock.mockResolvedValue(visualInput(3));
    const result = await generateScript(visualContext);
    expect(callStructuredMock).toHaveBeenCalledTimes(1);
    expect(callStructuredMock.mock.calls[0][0].userMessage).toContain("<format>\nCarousel of 3 slides");
    expect(result.contentType === "visual" && result.storyboard).toHaveLength(3);
  });

  it("retente une fois avec un rappel, puis tronque si l'écart persiste", async () => {
    callStructuredMock.mockResolvedValueOnce(visualInput(5)).mockResolvedValueOnce(visualInput(6));
    const result = await generateScript(visualContext);
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
    expect(callStructuredMock.mock.calls[1][0].userMessage).toContain("Format reminder: the storyboard must have exactly 3 entry(ies), you returned 5");
    expect(result.contentType === "visual" && result.storyboard).toHaveLength(3);
  });

  it("n'émet pas de bloc FORMAT pour un post texte", async () => {
    callStructuredMock.mockResolvedValue(validTextInput);
    await generateScript(textContext);
    expect(callStructuredMock.mock.calls[0][0].userMessage).not.toContain("<format>");
  });
});

describe("préparation, contrôles et seconde tentative (docs/SPEC_PROMPT_GENERATION_V3.md §3-§5)", () => {
  const prep = {
    reader: { label: "Devs", knows: "React", wants: "Le chiffre" },
    candidateMoments: [{ moment: "Refactor", excerpt: "" }],
    chosenMoment: { index: 0, why: "Le plus fort" },
    hookOptions: [{ kind: "chiffre", text: "4 000 lignes en moins" }],
    chosenHook: { index: 0, why: "Concret" },
    selfCheck: { factsFromMaterial: true, bannedPhrasesFound: [], readerTest: "Il veut le chiffre.", authorTest: true },
  };
  const clean = { ...validTextInput, ...prep, caption: "Un texte assez long pour LinkedIn. ".repeat(25), hashtags: [] };

  it("un post propre part en un appel, avec sa trace", async () => {
    callStructuredMock.mockResolvedValue(clean);
    const result = await generateScript(textContext);
    expect(callStructuredMock).toHaveBeenCalledTimes(1);
    expect(callStructuredMock.mock.calls[0][0].maxTokens).toBe(4096);
    expect(result.trace).toMatchObject({ version: 3, reader: { label: "Devs" }, checks: { failures: [], retried: false } });
    // La préparation n'est pas recopiée dans les champs du post.
    expect(result).not.toHaveProperty("reader");
  });

  it("un contrôle raté déclenche une seconde tentative avec le bloc <refusal>, et la meilleure est gardée", async () => {
    callStructuredMock.mockResolvedValueOnce({ ...clean, caption: `${clean.caption} Discover how it works.` }).mockResolvedValueOnce(clean);
    const result = await generateScript(textContext);
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
    expect(callStructuredMock.mock.calls[1][0].userMessage).toContain("<refusal>\nYour previous version was rejected:\n- Banned phrasing: \"discover how/why/what\"");
    expect(result.caption).not.toContain("Discover");
    expect(result.trace?.checks).toEqual({ failures: [], retried: true });
  });

  it("garde la première si la seconde est pire, et n'échoue jamais pour un contrôle", async () => {
    const first = { ...clean, caption: `${clean.caption} Discover how.` };
    callStructuredMock.mockResolvedValueOnce(first).mockResolvedValueOnce({ ...first, caption: "Discover how, don't hesitate to." });
    const result = await generateScript(textContext);
    expect(result.caption).toBe(first.caption);
    expect(result.trace?.checks.failures).toHaveLength(1);
  });

  it("garde la première si la seconde tentative est illisible", async () => {
    const first = { ...clean, caption: `${clean.caption} Discover how.` };
    callStructuredMock.mockResolvedValueOnce(first).mockResolvedValueOnce({ title: "Incomplet" });
    const result = await generateScript(textContext);
    expect(result.caption).toBe(first.caption);
  });

  it("une relecture déclarée en échec suffit à relancer", async () => {
    callStructuredMock
      .mockResolvedValueOnce({ ...clean, selfCheck: { ...prep.selfCheck, authorTest: false } })
      .mockResolvedValueOnce(clean);
    await generateScript(textContext);
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
  });
});

describe("première réponse illisible (revue du 2026-10-17)", () => {
  const ok = {
    ...validTextInput,
    caption: "Un texte assez long pour LinkedIn. ".repeat(25),
    hashtags: [],
  };

  it("retente une fois en signalant les champs manquants, puis garde la seconde", async () => {
    callStructuredMock.mockResolvedValueOnce({ title: "Incomplet" }).mockResolvedValueOnce(ok);
    const result = await generateScript(textContext);
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
    expect(callStructuredMock.mock.calls[1][0].userMessage).toContain("Your response did not respect the tool's format");
    expect(result.caption).toBe(ok.caption);
  });

  it("lève l'erreur de validation si les deux réponses sont illisibles", async () => {
    callStructuredMock.mockResolvedValue({ title: "Incomplet" });
    await expect(generateScript(textContext)).rejects.toThrow();
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
  });
});

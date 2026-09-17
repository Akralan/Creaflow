import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
}));

import { generateScript } from "./generateScript";
import {
  GENERATE_VIDEO_SCRIPT_TOOL_NAME,
  GENERATE_VISUAL_POST_TOOL_NAME,
  GENERATE_TEXT_POST_TOOL_NAME,
} from "./scriptSchema";
import type { ScriptGenerationContext } from "./prompts";

const baseContext = {
  creatorProfile: {
    brandName: "Bougies Test",
    activityType: "Artisan bougies",
    tone: "chaleureux",
  },
  platform: "tiktok",
  contentCategory: { id: "cat-1", label: "Vente", description: "Contenu orienté vente." },
};

const videoContext: ScriptGenerationContext = { ...baseContext, contentType: "video" };

const validVideoInput = {
  concept: "Idée unique du post, à qui elle s'adresse, ce qu'il doit en retenir.",
  title: "Titre",
  hookVisual: "Visuel",
  hookText: "Texte",
  hookAudio: "Audio",
  storyboard: [{ planNumber: 1, description: "Plan 1" }],
  caption: "Légende",
  hashtags: ["#test"],
  soundRecommendation: "Son",
};

beforeEach(() => {
  callStructuredMock.mockReset();
});

describe("generateScript", () => {
  it("renvoie le script structuré renvoyé par le provider, avec le contentType attaché", async () => {
    callStructuredMock.mockResolvedValue(validVideoInput);

    const result = await generateScript(videoContext);
    expect(result).toEqual({ contentType: "video", ...validVideoInput, usedExcerpts: [], promisesMade: [] });
  });

  it("propage l'erreur si le provider ne renvoie pas de réponse structurée", async () => {
    callStructuredMock.mockRejectedValue(new Error("Le modèle n'a pas renvoyé de réponse structurée."));
    await expect(generateScript(videoContext)).rejects.toThrow("n'a pas renvoyé de réponse structurée");
  });

  it("lève une erreur si le contenu renvoyé ne respecte pas le schéma attendu", async () => {
    callStructuredMock.mockResolvedValue({ title: "Incomplet" });
    await expect(generateScript(videoContext)).rejects.toThrow();
  });

  it("appelle le provider avec l'outil generate_video_script pour un contentType video", async () => {
    callStructuredMock.mockResolvedValue(validVideoInput);
    await generateScript(videoContext);
    expect(callStructuredMock).toHaveBeenCalledWith(
      expect.objectContaining({ tool: expect.objectContaining({ name: GENERATE_VIDEO_SCRIPT_TOOL_NAME }) })
    );
  });

  it("appelle le provider avec l'outil generate_visual_post pour un contentType visual", async () => {
    callStructuredMock.mockResolvedValue({
      concept: "Idée unique du post.",
      title: "Titre",
      hookVisual: "Visuel",
      storyboard: [{ planNumber: 1, description: "Slide 1" }],
      caption: "Légende",
      hashtags: ["#test"],
    });
    await generateScript({ ...baseContext, contentType: "visual" });
    expect(callStructuredMock).toHaveBeenCalledWith(
      expect.objectContaining({ tool: expect.objectContaining({ name: GENERATE_VISUAL_POST_TOOL_NAME }) })
    );
  });

  it("appelle le provider avec l'outil generate_text_post pour un contentType text", async () => {
    callStructuredMock.mockResolvedValue({
      concept: "Idée unique du post.",
      title: "Titre",
      hookText: "Accroche",
      caption: "Texte complet",
      hashtags: [],
    });
    const result = await generateScript({ ...baseContext, contentType: "text" });
    expect(result).toEqual({
      contentType: "text",
      concept: "Idée unique du post.",
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
    sentenceLength: "courtes",
    emojiUsage: "aucun",
    vocabulary: "simple",
    summary: "Direct, sans emoji.",
    rules: [
      { text: "Jamais d'emoji.", platform: null },
      { text: "Pas de hashtag dans le corps.", platform: "linkedin" },
    ],
    avoid: ["découvrez"],
    prefer: [],
    evidence: { scriptCount: 3, learnedAt: null },
  };

  it("injecte la voix et les règles de la plateforme cible dans le message", async () => {
    callStructuredMock.mockResolvedValue(validVideoInput);
    await generateScript({ ...videoContext, styleProfile });
    const userMessage: string = callStructuredMock.mock.calls[0][0].userMessage;
    expect(userMessage).toContain("=== STYLE ===\nVoix : Direct, sans emoji.");
    expect(userMessage).toContain("- Jamais d'emoji.");
    expect(userMessage).not.toContain("Pas de hashtag dans le corps.");
    expect(userMessage).toContain("À bannir : découvrez");
  });

  it("n'émet aucun bloc STYLE sans profil", async () => {
    callStructuredMock.mockResolvedValue(validVideoInput);
    await generateScript(videoContext);
    const userMessage: string = callStructuredMock.mock.calls[0][0].userMessage;
    expect(userMessage).not.toContain("=== STYLE ===");
  });
});

describe("format du post visuel (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §5.1)", () => {
  const visualInput = (n: number) => ({
    concept: "Idée",
    title: "Titre",
    hookVisual: "Visuel",
    storyboard: Array.from({ length: n }, (_, i) => ({ planNumber: i + 1, description: `Slide ${i + 1}` })),
    caption: "Légende",
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
    expect(callStructuredMock.mock.calls[0][0].userMessage).toContain("=== FORMAT ===\nCarrousel de 3 slides");
    expect(result.contentType === "visual" && result.storyboard).toHaveLength(3);
  });

  it("retente une fois avec un rappel, puis tronque si l'écart persiste", async () => {
    callStructuredMock.mockResolvedValueOnce(visualInput(5)).mockResolvedValueOnce(visualInput(6));
    const result = await generateScript(visualContext);
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
    expect(callStructuredMock.mock.calls[1][0].userMessage).toContain("Rappel de format : le storyboard doit avoir exactement 3 entrée(s), tu en as renvoyé 5");
    expect(result.contentType === "visual" && result.storyboard).toHaveLength(3);
  });

  it("n'émet pas de bloc FORMAT pour une vidéo", async () => {
    callStructuredMock.mockResolvedValue(validVideoInput);
    await generateScript(videoContext);
    expect(callStructuredMock.mock.calls[0][0].userMessage).not.toContain("=== FORMAT ===");
  });
});

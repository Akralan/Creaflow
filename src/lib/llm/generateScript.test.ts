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
    expect(result).toEqual({ contentType: "video", ...validVideoInput });
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
      title: "Titre",
      hookText: "Accroche",
      caption: "Texte complet",
      hashtags: [],
    });
    const result = await generateScript({ ...baseContext, contentType: "text" });
    expect(result).toEqual({
      contentType: "text",
      title: "Titre",
      hookText: "Accroche",
      caption: "Texte complet",
      hashtags: [],
    });
    expect(callStructuredMock).toHaveBeenCalledWith(
      expect.objectContaining({ tool: expect.objectContaining({ name: GENERATE_TEXT_POST_TOOL_NAME }) })
    );
  });
});

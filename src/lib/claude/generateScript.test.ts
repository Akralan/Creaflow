import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("./client", () => ({
  getClaudeClient: () => ({ messages: { create: createMock } }),
  CLAUDE_MODEL: "claude-test-model",
}));

import { generateScript } from "./generateScript";
import type { ScriptGenerationContext } from "./prompts";

const context: ScriptGenerationContext = {
  creatorProfile: {
    brandName: "Bougies Test",
    activityType: "Artisan bougies",
    tone: "chaleureux",
  },
  platform: "tiktok",
  contentCategory: "vente",
};

const validToolInput = {
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
  createMock.mockReset();
});

describe("generateScript", () => {
  it("renvoie le script structuré depuis le bloc tool_use", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", name: "generate_script", input: validToolInput }],
    });

    const result = await generateScript(context);
    expect(result).toEqual(validToolInput);
  });

  it("lève une erreur si Claude ne renvoie pas de bloc tool_use", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "oups" }] });
    await expect(generateScript(context)).rejects.toThrow("n'a pas renvoyé de script structuré");
  });

  it("lève une erreur si le contenu du tool_use ne respecte pas le schéma attendu", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", name: "generate_script", input: { title: "Incomplet" } }],
    });
    await expect(generateScript(context)).rejects.toThrow();
  });

  it("force la sortie via tool_choice sur generate_script", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", name: "generate_script", input: validToolInput }],
    });

    await generateScript(context);

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_choice: { type: "tool", name: "generate_script" },
      })
    );
  });
});

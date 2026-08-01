import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("./client", () => ({
  getClaudeClient: () => ({ messages: { create: createMock } }),
  CLAUDE_MODEL: "claude-test-model",
}));

import { analyzeStyle, styleProfileSchema } from "./styleProfile";

const validProfile = {
  tone: "direct et chaleureux",
  sentenceLength: "phrases courtes",
  emojiUsage: "quelques emojis, avec parcimonie",
  vocabulary: "familier, accessible",
  summary: "Ton direct et chaleureux, phrases courtes, peu d'emojis.",
};

describe("styleProfileSchema", () => {
  it("accepte un profil de style complet", () => {
    expect(() => styleProfileSchema.parse(validProfile)).not.toThrow();
  });

  it("rejette un profil sans summary", () => {
    const withoutSummary: Partial<typeof validProfile> = { ...validProfile };
    delete withoutSummary.summary;
    expect(() => styleProfileSchema.parse(withoutSummary)).toThrow();
  });

  it("rejette une valeur vide pour un champ requis", () => {
    expect(() => styleProfileSchema.parse({ ...validProfile, tone: "" })).toThrow();
  });
});

describe("analyzeStyle", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("renvoie le profil de style structuré depuis le bloc tool_use", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", name: "analyze_style", input: validProfile }],
    });

    const result = await analyzeStyle(["Légende 1", "Légende 2"]);
    expect(result).toEqual(validProfile);
  });

  it("lève une erreur si Claude ne renvoie pas de bloc tool_use", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "oups" }] });
    await expect(analyzeStyle(["Légende 1"])).rejects.toThrow(
      "n'a pas renvoyé d'analyse de style structurée"
    );
  });

  it("lève une erreur si le contenu ne respecte pas le schéma attendu", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", name: "analyze_style", input: { tone: "direct" } }],
    });
    await expect(analyzeStyle(["Légende 1"])).rejects.toThrow();
  });
});

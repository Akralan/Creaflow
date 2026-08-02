import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
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
    callStructuredMock.mockReset();
  });

  it("renvoie le profil de style structuré renvoyé par le provider", async () => {
    callStructuredMock.mockResolvedValue(validProfile);

    const result = await analyzeStyle(["Légende 1", "Légende 2"]);
    expect(result).toEqual(validProfile);
  });

  it("propage l'erreur si le provider ne renvoie pas de réponse structurée", async () => {
    callStructuredMock.mockRejectedValue(new Error("Le modèle n'a pas renvoyé de réponse structurée."));
    await expect(analyzeStyle(["Légende 1"])).rejects.toThrow("n'a pas renvoyé de réponse structurée");
  });

  it("lève une erreur si le contenu renvoyé ne respecte pas le schéma attendu", async () => {
    callStructuredMock.mockResolvedValue({ tone: "direct" });
    await expect(analyzeStyle(["Légende 1"])).rejects.toThrow();
  });
});

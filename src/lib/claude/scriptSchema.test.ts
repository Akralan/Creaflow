import { describe, expect, it } from "vitest";
import { generatedScriptSchema } from "./scriptSchema";

const validScript = {
  title: "Coulisses - Réalisation d'une commande",
  hookVisual: "Gros plan sur les mains qui découpent le sticker",
  hookText: "Regarde comment je fais ça",
  hookAudio: "Musique tendance en fond",
  storyboard: [
    { planNumber: 1, description: "Découpe du sticker" },
    { planNumber: 2, description: "Application presse à chaud" },
  ],
  caption: "Une commande comme on les aime ✨",
  hashtags: ["#artisanat", "#faitmain"],
  soundRecommendation: "Son tendance TikTok actuel",
};

describe("generatedScriptSchema", () => {
  it("accepte un script complet et valide", () => {
    expect(() => generatedScriptSchema.parse(validScript)).not.toThrow();
  });

  it("rejette un script sans hashtags", () => {
    const withoutHashtags: Partial<typeof validScript> = { ...validScript };
    delete withoutHashtags.hashtags;
    expect(() => generatedScriptSchema.parse(withoutHashtags)).toThrow();
  });

  it("rejette un storyboard vide", () => {
    expect(() => generatedScriptSchema.parse({ ...validScript, storyboard: [] })).toThrow();
  });

  it("rejette un plan de storyboard sans description", () => {
    const invalid = {
      ...validScript,
      storyboard: [{ planNumber: 1 }],
    };
    expect(() => generatedScriptSchema.parse(invalid)).toThrow();
  });

  it("rejette un planNumber non numérique", () => {
    const invalid = {
      ...validScript,
      storyboard: [{ planNumber: "un", description: "Découpe" }],
    };
    expect(() => generatedScriptSchema.parse(invalid)).toThrow();
  });

  it("rejette une liste de hashtags vide", () => {
    expect(() => generatedScriptSchema.parse({ ...validScript, hashtags: [] })).toThrow();
  });
});

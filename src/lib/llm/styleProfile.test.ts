import { describe, expect, it } from "vitest";
import { buildStyleBlock, parseStoredStyleProfile, styleProfileSchema } from "./styleProfile";

const legacyProfile = {
  tone: "direct et chaleureux",
  sentenceLength: "phrases courtes",
  emojiUsage: "quelques emojis, avec parcimonie",
  vocabulary: "familier, accessible",
  summary: "Ton direct et chaleureux, phrases courtes, peu d'emojis.",
};

describe("styleProfileSchema", () => {
  it("accepte un profil ancien (sans règles) et le complète avec des listes vides", () => {
    const parsed = styleProfileSchema.parse(legacyProfile);
    expect(parsed.rules).toEqual([]);
    expect(parsed.avoid).toEqual([]);
    expect(parsed.prefer).toEqual([]);
    expect(parsed.evidence).toEqual({ scriptCount: 0, learnedAt: null });
  });

  it("rejette un profil sans summary", () => {
    const withoutSummary: Partial<typeof legacyProfile> = { ...legacyProfile };
    delete withoutSummary.summary;
    expect(() => styleProfileSchema.parse(withoutSummary)).toThrow();
  });

  it("plafonne le nombre de règles à 12", () => {
    const rules = Array.from({ length: 13 }, (_, i) => ({ text: `Règle ${i}`, platform: null }));
    expect(() => styleProfileSchema.parse({ ...legacyProfile, rules })).toThrow();
  });

  it("parseStoredStyleProfile renvoie null sur un jsonb illisible", () => {
    expect(parseStoredStyleProfile(null)).toBeNull();
    expect(parseStoredStyleProfile("texte")).toBeNull();
    expect(parseStoredStyleProfile({ tone: "seul" })).toBeNull();
    expect(parseStoredStyleProfile(legacyProfile)?.summary).toBe(legacyProfile.summary);
  });
});

describe("buildStyleBlock", () => {
  const profile = styleProfileSchema.parse({
    ...legacyProfile,
    rules: [
      { text: "Jamais d'emoji.", platform: null },
      { text: "Pas de hashtag dans le corps.", platform: "linkedin" },
      { text: "Le hook tient en une phrase.", platform: "tiktok" },
    ],
    avoid: ["découvrez", "n'hésitez pas"],
    prefer: ["regarde", "on teste"],
  });

  it("renvoie une chaîne vide sans profil", () => {
    expect(buildStyleBlock(null, "tiktok")).toBe("");
    expect(buildStyleBlock(undefined, "tiktok")).toBe("");
  });

  it("injecte la voix, les règles globales et celles de la plateforme cible seulement", () => {
    const block = buildStyleBlock(profile, "linkedin");
    expect(block.startsWith("=== STYLE ===")).toBe(true);
    expect(block).toContain(`Voix : ${legacyProfile.summary}`);
    expect(block).toContain("- Jamais d'emoji.");
    expect(block).toContain("- Pas de hashtag dans le corps.");
    expect(block).not.toContain("Le hook tient en une phrase.");
    expect(block).toContain("À bannir : découvrez, n'hésitez pas");
    expect(block).toContain("À privilégier : regarde, on teste");
  });

  it("n'injecte aucune règle de plateforme quand la plateforme est inconnue", () => {
    const block = buildStyleBlock(profile, null);
    expect(block).toContain("- Jamais d'emoji.");
    expect(block).not.toContain("linkedin");
    expect(block).not.toContain("Le hook tient en une phrase.");
  });

  it("se limite à la voix pour un profil ancien sans règles", () => {
    const block = buildStyleBlock(styleProfileSchema.parse(legacyProfile), "tiktok");
    expect(block).toBe(`=== STYLE ===\nVoix : ${legacyProfile.summary}`);
  });
});

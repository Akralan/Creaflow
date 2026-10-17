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
    const rules = Array.from({ length: 13 }, (_, i) => ({ text: `Rule ${i}`, platform: null }));
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
      { text: "Never any emoji.", platform: null },
      { text: "No hashtag in the body.", platform: "linkedin" },
      { text: "The hook fits in one sentence.", platform: "instagram" },
    ],
    avoid: ["discover", "don't hesitate"],
    prefer: ["look", "we test"],
  });

  it("renvoie une chaîne vide sans profil", () => {
    expect(buildStyleBlock(null, "instagram")).toBe("");
    expect(buildStyleBlock(undefined, "instagram")).toBe("");
  });

  it("injecte la voix, les règles globales et celles de la plateforme cible seulement", () => {
    const block = buildStyleBlock(profile, "linkedin");
    expect(block.startsWith("=== STYLE ===")).toBe(true);
    expect(block).toContain(`Voice: ${legacyProfile.summary}`);
    expect(block).toContain("- Never any emoji.");
    expect(block).toContain("- No hashtag in the body.");
    expect(block).not.toContain("The hook fits in one sentence.");
    expect(block).toContain("Avoid: discover, don't hesitate");
    expect(block).toContain("Prefer: look, we test");
  });

  it("n'injecte aucune règle de plateforme quand la plateforme est inconnue", () => {
    const block = buildStyleBlock(profile, null);
    expect(block).toContain("- Never any emoji.");
    expect(block).not.toContain("linkedin");
    expect(block).not.toContain("The hook fits in one sentence.");
  });

  it("se limite à la voix pour un profil ancien sans règles", () => {
    const block = buildStyleBlock(styleProfileSchema.parse(legacyProfile), "instagram");
    expect(block).toBe(`=== STYLE ===\nVoice: ${legacyProfile.summary}`);
  });
});

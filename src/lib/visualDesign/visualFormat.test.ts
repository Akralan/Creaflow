import { describe, expect, it } from "vitest";
import { buildFormatBlock, enforceStoryboardCount, expectedStoryboardRange, normalizeVisualSpec, visualFormatFieldsSchema, visualSpecFromScript } from "./visualFormat";

describe("normalizeVisualSpec", () => {
  it("complète les défauts selon le format et efface les champs hors format", () => {
    expect(normalizeVisualSpec({})).toEqual({ format: "single", slideCount: null, durationMs: null });
    expect(normalizeVisualSpec({ visualFormat: "carousel" })).toEqual({ format: "carousel", slideCount: 5, durationMs: null });
    expect(normalizeVisualSpec({ visualFormat: "carousel", slideCount: 3, durationMs: 9000 })).toEqual({ format: "carousel", slideCount: 3, durationMs: null });
    expect(normalizeVisualSpec({ visualFormat: "animation" })).toEqual({ format: "animation", slideCount: null, durationMs: 8000 });
  });

  it("valide les bornes des champs de route", () => {
    expect(visualFormatFieldsSchema.safeParse({ visualFormat: "carousel", slideCount: 1 }).success).toBe(false);
    expect(visualFormatFieldsSchema.safeParse({ visualFormat: "animation", durationMs: 20000 }).success).toBe(false);
    expect(visualFormatFieldsSchema.safeParse({ visualFormat: "animation", durationMs: 6000 }).success).toBe(true);
  });

  it("lit une ligne script, y compris antérieure au chantier", () => {
    expect(visualSpecFromScript({ contentType: "video" })).toBeNull();
    expect(visualSpecFromScript({ contentType: "visual" })).toEqual({ format: "single", slideCount: null, durationMs: null });
    expect(visualSpecFromScript({ contentType: "visual", visualFormat: "carousel", slideCount: 4 })?.slideCount).toBe(4);
  });
});

describe("buildFormatBlock", () => {
  it("décrit chaque format au rédacteur", () => {
    expect(buildFormatBlock(null)).toBe("");
    expect(buildFormatBlock(normalizeVisualSpec({}))).toContain("exactement 1 entrée");
    expect(buildFormatBlock(normalizeVisualSpec({ visualFormat: "carousel", slideCount: 4 }))).toContain("exactement 4 entrées");
    const anim = buildFormatBlock(normalizeVisualSpec({ visualFormat: "animation", durationMs: 10000 }));
    expect(anim).toContain("Animation de 10 secondes");
    expect(anim).toContain("entre 3 et 6 entrées");
  });
});

describe("enforceStoryboardCount", () => {
  const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ planNumber: i + 1, description: `Plan ${i + 1}` }));

  it("accepte un storyboard dans les bornes", () => {
    expect(enforceStoryboardCount(steps(4), normalizeVisualSpec({ visualFormat: "carousel", slideCount: 4 })).ok).toBe(true);
    expect(enforceStoryboardCount(steps(5), normalizeVisualSpec({ visualFormat: "animation" })).ok).toBe(true);
    expect(expectedStoryboardRange(normalizeVisualSpec({}))).toEqual({ min: 1, max: 1 });
  });

  it("tronque un storyboard trop long et signale le rappel", () => {
    const check = enforceStoryboardCount(steps(3), normalizeVisualSpec({}));
    expect(check.ok).toBe(false);
    expect(check.storyboard).toHaveLength(1);
    expect(check.reminder).toContain("exactement 1 entrée(s), tu en as renvoyé 3");
  });

  it("garde un storyboard trop court tel quel", () => {
    const check = enforceStoryboardCount(steps(2), normalizeVisualSpec({ visualFormat: "carousel", slideCount: 5 }));
    expect(check.ok).toBe(false);
    expect(check.storyboard).toHaveLength(2);
  });

  it("ne contraint rien sans format (vidéo, texte)", () => {
    expect(enforceStoryboardCount(steps(7), null)).toEqual({ ok: true, storyboard: steps(7), reminder: null });
  });
});

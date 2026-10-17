import { describe, expect, it } from "vitest";
import { buildFormatBlock, enforceStoryboardCount, expectedStoryboardRange, normalizeVisualSpec, visualFormatFieldsSchema, visualSpecFromScript } from "./visualFormat";

describe("normalizeVisualSpec", () => {
  it("fills in defaults per format and clears out-of-format fields", () => {
    expect(normalizeVisualSpec({})).toEqual({ format: "single", slideCount: null, durationMs: null });
    expect(normalizeVisualSpec({ visualFormat: "carousel" })).toEqual({ format: "carousel", slideCount: 5, durationMs: null });
    expect(normalizeVisualSpec({ visualFormat: "carousel", slideCount: 3, durationMs: 9000 })).toEqual({ format: "carousel", slideCount: 3, durationMs: null });
    expect(normalizeVisualSpec({ visualFormat: "animation" })).toEqual({ format: "animation", slideCount: null, durationMs: 8000 });
  });

  it("validates the bounds of route fields", () => {
    expect(visualFormatFieldsSchema.safeParse({ visualFormat: "carousel", slideCount: 1 }).success).toBe(false);
    expect(visualFormatFieldsSchema.safeParse({ visualFormat: "animation", durationMs: 20000 }).success).toBe(false);
    expect(visualFormatFieldsSchema.safeParse({ visualFormat: "animation", durationMs: 6000 }).success).toBe(true);
  });

  it("reads a script row, including ones predating this feature", () => {
    expect(visualSpecFromScript({ contentType: "text" })).toBeNull();
    expect(visualSpecFromScript({ contentType: "visual" })).toEqual({ format: "single", slideCount: null, durationMs: null });
    expect(visualSpecFromScript({ contentType: "visual", visualFormat: "carousel", slideCount: 4 })?.slideCount).toBe(4);
  });
});

describe("buildFormatBlock", () => {
  it("asks for a real post text when the visual accompanies it, a short caption otherwise", () => {
    const withText = buildFormatBlock(normalizeVisualSpec({ visualFormat: "animation" }));
    const visualOnly = buildFormatBlock(normalizeVisualSpec({ visualFormat: "animation", withText: false }));
    expect(withText).toContain("Post text: the caption is a real, complete, written post");
    expect(visualOnly).toContain("Short caption: one or two sentences at most");
    expect(visualOnly).not.toContain("Post text");
  });

  it("describes each format to the writer", () => {
    expect(buildFormatBlock(null)).toBe("");
    expect(buildFormatBlock(normalizeVisualSpec({}))).toContain("exactly 1 entry");
    expect(buildFormatBlock(normalizeVisualSpec({ visualFormat: "carousel", slideCount: 4 }))).toContain("exactly 4 entries");
    const anim = buildFormatBlock(normalizeVisualSpec({ visualFormat: "animation", durationMs: 10000 }));
    expect(anim).toContain("Animation of 10 seconds");
    expect(anim).toContain("between 3 and 6 entries");
  });
});

describe("enforceStoryboardCount", () => {
  const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ planNumber: i + 1, description: `Plan ${i + 1}` }));

  it("accepts a storyboard within bounds", () => {
    expect(enforceStoryboardCount(steps(4), normalizeVisualSpec({ visualFormat: "carousel", slideCount: 4 })).ok).toBe(true);
    expect(enforceStoryboardCount(steps(5), normalizeVisualSpec({ visualFormat: "animation" })).ok).toBe(true);
    expect(expectedStoryboardRange(normalizeVisualSpec({}))).toEqual({ min: 1, max: 1 });
  });

  it("truncates a storyboard that is too long and signals the reminder", () => {
    const check = enforceStoryboardCount(steps(3), normalizeVisualSpec({}));
    expect(check.ok).toBe(false);
    expect(check.storyboard).toHaveLength(1);
    expect(check.reminder).toContain("exactly 1 entry(ies), you returned 3");
  });

  it("keeps a storyboard that is too short as is", () => {
    const check = enforceStoryboardCount(steps(2), normalizeVisualSpec({ visualFormat: "carousel", slideCount: 5 }));
    expect(check.ok).toBe(false);
    expect(check.storyboard).toHaveLength(2);
  });

  it("constrains nothing without a format (text)", () => {
    expect(enforceStoryboardCount(steps(7), null)).toEqual({ ok: true, storyboard: steps(7), reminder: null });
  });
});

import { describe, expect, it } from "vitest";
import { buildVisualBriefMessage, fitStoryboard } from "./storyboardFromText";
import { normalizeVisualSpec } from "@/lib/visualDesign/visualFormat";

const steps = (n: number) => Array.from({ length: n }, (_, i) => ({ planNumber: i + 1, description: ` Slide ${i + 1} ` }));

describe("fitStoryboard", () => {
  it("keeps a carousel to the number of slides asked, numbered from 1", () => {
    const spec = normalizeVisualSpec({ visualFormat: "carousel", slideCount: 3 });
    const brief = fitStoryboard({ hookVisual: " Hook ", storyboard: [...steps(5)].reverse() }, spec);
    expect(brief.hookVisual).toBe("Hook");
    expect(brief.storyboard.map((s) => s.planNumber)).toEqual([1, 2, 3]);
    expect(brief.storyboard[0].description).toBe("Slide 1");
  });

  it("refuses a carousel with too few slides", () => {
    const spec = normalizeVisualSpec({ visualFormat: "carousel", slideCount: 5 });
    expect(() => fitStoryboard({ hookVisual: "h", storyboard: steps(3) }, spec)).toThrow(/expected 5/);
  });

  it("takes a single image as exactly one slide", () => {
    const brief = fitStoryboard({ hookVisual: "h", storyboard: steps(4) }, normalizeVisualSpec({ visualFormat: "single" }));
    expect(brief.storyboard).toHaveLength(1);
  });

  it("accepts three to six moments for an animation", () => {
    const spec = normalizeVisualSpec({ visualFormat: "animation", durationMs: 8000 });
    expect(fitStoryboard({ hookVisual: "h", storyboard: steps(8) }, spec).storyboard).toHaveLength(6);
    expect(() => fitStoryboard({ hookVisual: "h", storyboard: steps(2) }, spec)).toThrow(/3 to 6/);
  });
});

describe("buildVisualBriefMessage", () => {
  it("carries the post as it is and the format asked", () => {
    const message = buildVisualBriefMessage({ platform: "linkedin", title: "A title", text: "The post.\n\nSecond paragraph.", spec: normalizeVisualSpec({ visualFormat: "animation", durationMs: 10000 }) });
    expect(message).toContain("The post.\n\nSecond paragraph.");
    expect(message).toContain("10 seconds");
    expect(message).toContain("Title: A title");
  });
});

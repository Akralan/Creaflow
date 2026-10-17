import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { generationRequest } from "./ScriptFormatChooser";

describe("generationRequest", () => {
  it("text only → text post", () => {
    expect(generationRequest(null, true)).toEqual({ contentType: "text", fields: undefined });
  });

  it("animation + text → a visual post whose caption is a fully written text", () => {
    expect(generationRequest("animation", true)).toMatchObject({
      contentType: "visual",
      fields: { visualFormat: "animation", withText: true },
    });
  });

  it("photo only (1 image) → single image with a short caption", () => {
    expect(generationRequest("carousel", false)).toMatchObject({
      contentType: "visual",
      fields: { visualFormat: "single", withText: false },
    });
  });

  it("several images → carousel of the chosen size", () => {
    expect(generationRequest("carousel", true, { images: 5, seconds: 8 })).toMatchObject({
      fields: { visualFormat: "carousel", slideCount: 5, withText: true },
    });
  });

  it("animation → chosen duration in milliseconds", () => {
    expect(generationRequest("animation", true, { images: 1, seconds: 12 })).toMatchObject({
      fields: { visualFormat: "animation", durationMs: 12000 },
    });
  });

  it("nothing ticked → no generation", () => {
    expect(generationRequest(null, false)).toBeNull();
  });
});

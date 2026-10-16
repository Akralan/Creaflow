import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { generationRequest } from "./ScriptFormatChooser";

describe("generationRequest", () => {
  it("texte seul → post texte", () => {
    expect(generationRequest(null, true)).toEqual({ contentType: "text", fields: undefined });
  });

  it("animation + texte → un post visuel dont la légende est un vrai texte", () => {
    expect(generationRequest("animation", true)).toMatchObject({
      contentType: "visual",
      fields: { visualFormat: "animation", withText: true },
    });
  });

  it("photo seule (1 image) → image unique à légende courte", () => {
    expect(generationRequest("carousel", false)).toMatchObject({
      contentType: "visual",
      fields: { visualFormat: "single", withText: false },
    });
  });

  it("plusieurs images → carrousel du nombre choisi", () => {
    expect(generationRequest("carousel", true, { images: 5, seconds: 8 })).toMatchObject({
      fields: { visualFormat: "carousel", slideCount: 5, withText: true },
    });
  });

  it("animation → durée choisie en millisecondes", () => {
    expect(generationRequest("animation", true, { images: 1, seconds: 12 })).toMatchObject({
      fields: { visualFormat: "animation", durationMs: 12000 },
    });
  });

  it("rien de coché → pas de génération", () => {
    expect(generationRequest(null, false)).toBeNull();
  });
});

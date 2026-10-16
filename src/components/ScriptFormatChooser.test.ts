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

  it("photo / carrousel seul → post visuel à légende courte", () => {
    expect(generationRequest("carousel", false)).toMatchObject({
      contentType: "visual",
      fields: { visualFormat: "carousel", withText: false },
    });
  });

  it("rien de coché → pas de génération", () => {
    expect(generationRequest(null, false)).toBeNull();
  });
});

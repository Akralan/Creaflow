import { describe, expect, it } from "vitest";
import { describeUiElementsForPrompt, findUiElement, UI_ELEMENTS } from "./uiElements";
import { sanitizeSlideHtml } from "./htmlSanitizer";

const theme = { palette: ["#1a1a1a", "#f4e9d8", "#c98a3a"], fontHeading: "Playfair Display", fontBody: "Inter" };
const canvases = [
  { width: 1080, height: 1350 },
  { width: 1080, height: 1920 },
  { width: 1600, height: 900 },
];

describe("catalogue d'éléments d'interface", () => {
  it("chaque élément passe la liste blanche tel quel, sur tous les formats, et devient un calque", () => {
    for (const element of UI_ELEMENTS) {
      for (const canvas of canvases) {
        const slide = `<div>${element.html(theme, canvas)}</div>`;
        const result = sanitizeSlideHtml(slide, { ...canvas, hasLogo: false, imageRefs: [] });
        expect(result.layerCount, element.id).toBe(1);
        expect(result.html, element.id).toContain('data-layer="l1"');
      }
    }
  });

  it("a des identifiants uniques et une description pour le prompt", () => {
    expect(new Set(UI_ELEMENTS.map((e) => e.id)).size).toBe(UI_ELEMENTS.length);
    expect(findUiElement("price-tag")?.label).toBe("Price tag");
    expect(findUiElement("nope")).toBeNull();
    const prompt = describeUiElementsForPrompt();
    expect(prompt).toContain("price tag");
    expect(prompt).toContain("browser frame");
  });

  it("reprend les couleurs et polices du thème, avec un repli quand la palette est courte", () => {
    expect(findUiElement("badge")!.html(theme, canvases[0])).toContain("background:#1a1a1a");
    expect(findUiElement("cta-button")!.html({ ...theme, palette: ["#000"] }, canvases[0])).toContain("background:#000");
    expect(findUiElement("price-tag")!.html(theme, canvases[0])).toContain("font-family:Playfair Display");
  });
});

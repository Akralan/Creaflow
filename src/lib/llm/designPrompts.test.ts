import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
}));

import { buildDesignSystemPrompt, composeDesign, reviseDesign, type DesignPromptContext } from "./designPrompts";
import { DesignValidationError } from "@/lib/visualDesign/htmlSanitizer";

const prompt: DesignPromptContext = { width: 1080, height: 1350, hasLogo: false, brandKitDescription: "", vertical: "artisan" };

const post = {
  platform: "instagram",
  title: "Trois soirs",
  hookVisual: "Bougie allumée sur bois brut",
  storyboard: [
    { planNumber: 1, description: "Photo produit, titre « Une bougie, trois soirs »" },
    { planNumber: 2, description: "Prix 24 € et appel à l'action « Commande sur le site »" },
  ],
  brandName: "Cire & Co",
  tone: "chaleureux",
  baseDescription: "Bougie blanche dans un pot en verre ambré, lumière chaude",
  baseOrientation: "portrait",
};

const goodSlide = (n: number) =>
  `<div style="position:relative;width:1080px;height:1350px"><div data-layer="t${n}" data-type="text" style="position:absolute;top:80px;left:60px;font-family:Inter;font-size:64px;color:#fff">Slide ${n}</div></div>`;

const goodResult = {
  theme: { palette: ["#1a1a1a", "#f4e9d8", "#c98a3a"], fontHeading: "Playfair Display", fontBody: "Inter", mood: "chaleureux" },
  slides: [
    { planNumber: 1, html: goodSlide(1) },
    { planNumber: 2, html: goodSlide(2) },
  ],
  rationale: "Titre en haut, produit dégagé.",
};

beforeEach(() => {
  callStructuredMock.mockReset();
});

describe("buildDesignSystemPrompt", () => {
  it("nomme le canevas, les polices et l'orientation de la verticale", () => {
    const system = buildDesignSystemPrompt(prompt);
    expect(system).toContain("Canevas : 1080×1350 px");
    expect(system).toContain("Inter, Space Grotesk, Playfair Display");
    expect(system).toContain("Artisan : la photo du produit est le sujet");
    expect(system).not.toContain("{{LOGO}}");
    expect(buildDesignSystemPrompt({ ...prompt, hasLogo: true, brandKitDescription: "couleurs #111" })).toContain('ou src="{{LOGO}}"');
  });
});

describe("composeDesign", () => {
  it("renvoie les slides passées par la liste blanche", async () => {
    callStructuredMock.mockResolvedValue(goodResult);
    const result = await composeDesign({ prompt, post });
    expect(result.slides).toHaveLength(2);
    expect(result.slides[0].html).toContain('data-layer="t1" data-type="text"');
    expect(result.slides[0].html).toContain("overflow:hidden");
    expect(callStructuredMock).toHaveBeenCalledTimes(1);
    const userMessage: string = callStructuredMock.mock.calls[0][0].userMessage;
    expect(userMessage).toContain("1. Photo produit");
    expect(userMessage).toContain("Description : Bougie blanche");
  });

  it("retente une fois avec le rapport d'erreurs quand une slide est refusée", async () => {
    callStructuredMock
      .mockResolvedValueOnce({ ...goodResult, slides: [{ planNumber: 1, html: `<div><script>x</script></div>` }] })
      .mockResolvedValueOnce(goodResult);
    const result = await composeDesign({ prompt, post });
    expect(result.slides).toHaveLength(2);
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
    const retryMessage: string = callStructuredMock.mock.calls[1][0].userMessage;
    expect(retryMessage).toContain("TA PRÉCÉDENTE RÉPONSE A ÉTÉ REFUSÉE");
    expect(retryMessage).toContain("slide 1 : balise <script> interdite");
  });

  it("échoue si la seconde tentative est encore refusée", async () => {
    callStructuredMock.mockResolvedValue({ ...goodResult, slides: [{ planNumber: 1, html: `<div><div onclick="x">a</div></div>` }] });
    await expect(composeDesign({ prompt, post })).rejects.toBeInstanceOf(DesignValidationError);
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
  });
});

describe("reviseDesign", () => {
  it("transmet l'instruction, la portée et le HTML courant", async () => {
    callStructuredMock.mockResolvedValue(goodResult);
    await reviseDesign({
      prompt,
      instruction: "Titre plus gros",
      planNumber: 2,
      theme: goodResult.theme,
      slides: goodResult.slides,
    });
    const userMessage: string = callStructuredMock.mock.calls[0][0].userMessage;
    expect(userMessage).toContain("Titre plus gros");
    expect(userMessage).toContain("Portée : slide 2 uniquement");
    expect(userMessage).toContain("--- slide 1 ---");
    expect(userMessage).toContain("Conserve les data-layer existants");
  });
});

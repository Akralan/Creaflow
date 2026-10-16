import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
}));

import { buildDesignSystemPrompt, composeDesign, reviseDesign, type DesignImageContext, type DesignPromptContext } from "./designPrompts";
import { DesignValidationError } from "@/lib/visualDesign/htmlSanitizer";

const images: DesignImageContext[] = [
  { ref: "p1", description: "Bougie blanche dans un pot en verre ambré, lumière chaude", orientation: "portrait", productName: "Bougie Ambre", cutoutAvailable: true },
  { ref: "p2", description: "Mains versant de la cire dans des moules", orientation: "landscape", productName: null, cutoutAvailable: false },
];
const prompt: DesignPromptContext = { width: 1080, height: 1350, hasLogo: false, brandKitDescription: "", vertical: "artisan", images };

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
};

const goodSlide = (n: number) =>
  `<div style="position:relative;width:1080px;height:1350px"><div data-layer="t${n}" data-type="text" style="position:absolute;top:80px;left:60px;font-family:Inter;font-size:64px;color:#fff">Slide ${n}</div></div>`;

const goodResult = {
  theme: { palette: ["#1a1a1a", "#f4e9d8", "#c98a3a"], fontHeading: "Playfair Display", fontBody: "Inter", mood: "chaleureux" },
  slides: [
    { planNumber: 1, html: goodSlide(1) },
    { planNumber: 2, html: goodSlide(2) },
  ],
  images: [],
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
    expect(buildDesignSystemPrompt({ ...prompt, hasLogo: true, brandKitDescription: "couleurs #111" })).toContain('et src="{{LOGO}}"');
  });

  it("liste les photos déclarées, le détourage et les éléments d'interface", () => {
    const system = buildDesignSystemPrompt(prompt);
    expect(system).toContain('src="{{IMG:p1}}", "{{IMG:p2}}"');
    expect(system).toContain('"cutout"');
    expect(system).toContain("étiquette de prix");
    expect(system).toContain("Montages");
    const noPhoto = buildDesignSystemPrompt({ ...prompt, images: [] });
    expect(noPhoto).toContain("aucune (aucune photo fournie, pas de logo)");
    expect(noPhoto).not.toContain("cutout");
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
    expect(userMessage).toContain("=== PHOTOS ===\np1 : Bougie blanche dans un pot en verre ambré, lumière chaude · portrait · produit : Bougie Ambre · détourage disponible");
    expect(userMessage).toContain("p2 : Mains versant de la cire dans des moules · landscape · détourage non disponible");
    expect(result.images).toEqual([]);
  });

  it("relève les photos utilisées, applique la variante demandée et replie sur l'original si le détourage manque", async () => {
    const withPhotos = `<div style="position:relative;width:1080px;height:1350px"><div data-layer="a" data-type="image" style="position:absolute;top:0;left:0;width:1080px;height:700px"><img src="{{IMG:p1}}"></div><div data-layer="b" data-type="image" style="position:absolute;top:700px;left:0;width:1080px;height:650px"><img src="{{IMG:p2}}"></div></div>`;
    callStructuredMock.mockResolvedValue({
      ...goodResult,
      slides: [{ planNumber: 1, html: withPhotos }],
      images: [
        { ref: "p1", variant: "cutout" },
        { ref: "p2", variant: "cutout" },
      ],
    });
    const result = await composeDesign({ prompt, post });
    expect(result.images).toEqual([
      { ref: "p1", variant: "cutout" },
      { ref: "p2", variant: "original" },
    ]);
  });

  it("refuse une photo non déclarée, puis accepte la seconde tentative", async () => {
    const ghost = `<div style="position:relative;width:1080px;height:1350px"><div data-layer="a" data-type="image" style="position:absolute;top:0;left:0;width:1080px;height:700px"><img src="{{IMG:p5}}"></div></div>`;
    callStructuredMock.mockResolvedValueOnce({ ...goodResult, slides: [{ planNumber: 1, html: ghost }] }).mockResolvedValueOnce(goodResult);
    await composeDesign({ prompt, post });
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
    expect(callStructuredMock.mock.calls[1][0].userMessage).toContain("photo « p5 » non déclarée");
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
      currentVariants: [{ ref: "p1", variant: "cutout" }],
    });
    const userMessage: string = callStructuredMock.mock.calls[0][0].userMessage;
    expect(userMessage).toContain("Titre plus gros");
    expect(userMessage).toContain("Variantes actuelles : p1 = cutout");
    expect(userMessage).toContain("Portée : slide 2 uniquement");
    expect(userMessage).toContain("--- slide 1 ---");
    expect(userMessage).toContain("Conserve les data-layer existants");
  });
});

describe("animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md)", () => {
  const animPrompt: DesignPromptContext = { ...prompt, width: 1080, height: 1920, animationDurationMs: 8000 };
  const animSlide = `<div style="position:relative;width:1080px;height:1920px"><div data-layer="title" data-type="text" style="position:absolute;top:200px;left:80px;font-family:Inter;font-size:72px;color:#fff">Titre</div><div data-layer="cta" data-type="text" style="position:absolute;top:1500px;left:80px;font-family:Inter;font-size:48px;color:#fff">Commande</div></div>`;
  const animResult = {
    ...goodResult,
    slides: [{ planNumber: 1, html: animSlide }],
    timeline: [
      { layerId: "title", enter: "slide-up", startMs: 200, enterMs: 500, exit: "fade", exitAtMs: 4000 },
      { layerId: "cta", enter: "fade", startMs: 4200, enterMs: 400, exit: null, exitAtMs: null },
    ],
  };

  it("ajoute le paragraphe ANIMATION et présente les moments dans le message", async () => {
    callStructuredMock.mockResolvedValue(animResult);
    const result = await composeDesign({ prompt: animPrompt, post });
    const system: string = callStructuredMock.mock.calls[0][0].system;
    const userMessage: string = callStructuredMock.mock.calls[0][0].userMessage;
    expect(system).toContain("ANIMATION : cette maquette est une animation de 8000 ms");
    expect(userMessage).toContain("ANIMATION de 8000 ms sur une seule slide");
    expect(userMessage).toContain("Moment 1 : Photo produit");
    expect(result.timeline?.map((t) => t.layerId)).toEqual(["title", "cta"]);
  });

  it("refuse une timeline qui vise un calque inconnu, puis accepte la seconde tentative", async () => {
    callStructuredMock
      .mockResolvedValueOnce({ ...animResult, timeline: [{ layerId: "ghost", enter: "fade", startMs: 0, enterMs: 300, exit: null, exitAtMs: null }] })
      .mockResolvedValueOnce(animResult);
    const result = await composeDesign({ prompt: animPrompt, post });
    expect(callStructuredMock).toHaveBeenCalledTimes(2);
    expect(callStructuredMock.mock.calls[1][0].userMessage).toContain("ligne de temps : calque « ghost » inconnu");
    expect(result.timeline).toHaveLength(2);
  });

  it("refuse plusieurs slides pour une animation", async () => {
    callStructuredMock.mockResolvedValue({ ...animResult, slides: [{ planNumber: 1, html: animSlide }, { planNumber: 2, html: animSlide }] });
    await expect(composeDesign({ prompt: animPrompt, post })).rejects.toBeInstanceOf(DesignValidationError);
  });

  it("une maquette statique n'a pas de timeline même si le modèle en renvoie une", async () => {
    callStructuredMock.mockResolvedValue({ ...goodResult, timeline: [{ layerId: "t1", enter: "fade", startMs: 0, enterMs: 300, exit: null, exitAtMs: null }] });
    const result = await composeDesign({ prompt, post });
    expect(result.timeline).toBeNull();
  });
});

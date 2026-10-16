import { describe, expect, it } from "vitest";
import {
  visualScriptSchema,
  textScriptSchema,
  toolForContentType,
  GENERATE_VISUAL_POST_TOOL_NAME,
  GENERATE_TEXT_POST_TOOL_NAME,
} from "./scriptSchema";

describe("visualScriptSchema", () => {
  const validVisualPost = {
    concept: "Présenter la nouvelle collection à ceux qui suivent déjà la marque, pour qu'ils aillent voir le catalogue.",
    title: "Nouvelle collection",
    hookVisual: "Photo produit sur fond neutre, lumière naturelle",
    storyboard: [{ planNumber: 1, description: "Slide 1 : produit seul" }],
    caption: "La nouvelle collection est arrivée",
    hashtags: ["#nouveaute"],
  };

  it("accepte un post visuel complet", () => {
    expect(() => visualScriptSchema.parse(validVisualPost)).not.toThrow();
  });

  it("rejette un post visuel sans hookVisual", () => {
    const invalid: Partial<typeof validVisualPost> = { ...validVisualPost };
    delete invalid.hookVisual;
    expect(() => visualScriptSchema.parse(invalid)).toThrow();
  });

  it("rejette un storyboard vide", () => {
    expect(() => visualScriptSchema.parse({ ...validVisualPost, storyboard: [] })).toThrow();
  });

  it("rejette une slide sans description", () => {
    expect(() => visualScriptSchema.parse({ ...validVisualPost, storyboard: [{ planNumber: 1 }] })).toThrow();
  });

  it("rejette un planNumber non numérique", () => {
    const invalid = { ...validVisualPost, storyboard: [{ planNumber: "un", description: "Slide" }] };
    expect(() => visualScriptSchema.parse(invalid)).toThrow();
  });

  it("rejette une liste de hashtags vide", () => {
    expect(() => visualScriptSchema.parse({ ...validVisualPost, hashtags: [] })).toThrow();
  });
});

describe("textScriptSchema", () => {
  const validTextPost = {
    concept: "Partager ce que la première année de freelance a vraiment changé, pour rassurer ceux qui hésitent à se lancer.",
    title: "Retour d'expérience",
    hookText: "Ce que j'ai appris en un an de freelance",
    caption: "Texte complet du post...",
    hashtags: [],
  };

  it("accepte un post texte, sans champs visuels ni audio", () => {
    expect(() => textScriptSchema.parse(validTextPost)).not.toThrow();
  });

  it("accepte une liste de hashtags vide (plateformes texte sans hashtags)", () => {
    expect(() => textScriptSchema.parse({ ...validTextPost, hashtags: [] })).not.toThrow();
  });

  it("rejette un post texte sans hookText", () => {
    const invalid: Partial<typeof validTextPost> = { ...validTextPost };
    delete invalid.hookText;
    expect(() => textScriptSchema.parse(invalid)).toThrow();
  });
});

describe("toolForContentType", () => {
  it("sélectionne le bon tool selon le type de contenu", () => {
    expect(toolForContentType("visual").name).toBe(GENERATE_VISUAL_POST_TOOL_NAME);
    expect(toolForContentType("text").name).toBe(GENERATE_TEXT_POST_TOOL_NAME);
  });
});

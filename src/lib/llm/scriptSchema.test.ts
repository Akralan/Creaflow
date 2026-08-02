import { describe, expect, it } from "vitest";
import {
  videoScriptSchema,
  visualScriptSchema,
  textScriptSchema,
  toolForContentType,
  GENERATE_VIDEO_SCRIPT_TOOL_NAME,
  GENERATE_VISUAL_POST_TOOL_NAME,
  GENERATE_TEXT_POST_TOOL_NAME,
} from "./scriptSchema";

const validVideoScript = {
  title: "Coulisses - Réalisation d'une commande",
  hookVisual: "Gros plan sur les mains qui découpent le sticker",
  hookText: "Regarde comment je fais ça",
  hookAudio: "Musique tendance en fond",
  storyboard: [
    { planNumber: 1, description: "Découpe du sticker" },
    { planNumber: 2, description: "Application presse à chaud" },
  ],
  caption: "Une commande comme on les aime ✨",
  hashtags: ["#artisanat", "#faitmain"],
  soundRecommendation: "Son tendance TikTok actuel",
};

describe("videoScriptSchema", () => {
  it("accepte un script vidéo complet et valide", () => {
    expect(() => videoScriptSchema.parse(validVideoScript)).not.toThrow();
  });

  it("rejette un script sans hashtags", () => {
    const withoutHashtags: Partial<typeof validVideoScript> = { ...validVideoScript };
    delete withoutHashtags.hashtags;
    expect(() => videoScriptSchema.parse(withoutHashtags)).toThrow();
  });

  it("rejette un storyboard vide", () => {
    expect(() => videoScriptSchema.parse({ ...validVideoScript, storyboard: [] })).toThrow();
  });

  it("rejette un plan de storyboard sans description", () => {
    const invalid = { ...validVideoScript, storyboard: [{ planNumber: 1 }] };
    expect(() => videoScriptSchema.parse(invalid)).toThrow();
  });

  it("rejette un planNumber non numérique", () => {
    const invalid = { ...validVideoScript, storyboard: [{ planNumber: "un", description: "Découpe" }] };
    expect(() => videoScriptSchema.parse(invalid)).toThrow();
  });

  it("rejette une liste de hashtags vide", () => {
    expect(() => videoScriptSchema.parse({ ...validVideoScript, hashtags: [] })).toThrow();
  });
});

describe("visualScriptSchema", () => {
  const validVisualPost = {
    title: "Nouvelle collection",
    hookVisual: "Photo produit sur fond neutre, lumière naturelle",
    storyboard: [{ planNumber: 1, description: "Slide 1 : produit seul" }],
    caption: "La nouvelle collection est arrivée",
    hashtags: ["#nouveaute"],
  };

  it("accepte un post visuel complet, sans champs vidéo", () => {
    expect(() => visualScriptSchema.parse(validVisualPost)).not.toThrow();
  });

  it("rejette un post visuel sans hookVisual", () => {
    const invalid: Partial<typeof validVisualPost> = { ...validVisualPost };
    delete invalid.hookVisual;
    expect(() => visualScriptSchema.parse(invalid)).toThrow();
  });
});

describe("textScriptSchema", () => {
  const validTextPost = {
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
    expect(toolForContentType("video").name).toBe(GENERATE_VIDEO_SCRIPT_TOOL_NAME);
    expect(toolForContentType("visual").name).toBe(GENERATE_VISUAL_POST_TOOL_NAME);
    expect(toolForContentType("text").name).toBe(GENERATE_TEXT_POST_TOOL_NAME);
  });
});

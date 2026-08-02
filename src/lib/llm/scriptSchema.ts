import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import type { ContentType } from "./prompts";

export const storyboardStepSchema = z.object({
  planNumber: z.number().int().positive(),
  description: z.string().min(1),
});

const baseFields = {
  title: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).min(1),
};

export const videoScriptSchema = z.object({
  ...baseFields,
  hookVisual: z.string().min(1),
  hookText: z.string().min(1),
  hookAudio: z.string().min(1),
  storyboard: z.array(storyboardStepSchema).min(1),
  soundRecommendation: z.string().min(1),
});
export type VideoGeneratedScript = z.infer<typeof videoScriptSchema> & { contentType: "video" };

export const visualScriptSchema = z.object({
  ...baseFields,
  hookVisual: z.string().min(1),
  storyboard: z.array(storyboardStepSchema).min(1),
});
export type VisualGeneratedScript = z.infer<typeof visualScriptSchema> & { contentType: "visual" };

export const textScriptSchema = z.object({
  ...baseFields,
  hashtags: z.array(z.string()), // vide accepté : certaines plateformes texte (newsletter...) n'en utilisent pas.
  hookText: z.string().min(1),
});
export type TextGeneratedScript = z.infer<typeof textScriptSchema> & { contentType: "text" };

export type GeneratedScript = VideoGeneratedScript | VisualGeneratedScript | TextGeneratedScript;

export const GENERATE_VIDEO_SCRIPT_TOOL_NAME = "generate_video_script";
export const GENERATE_VISUAL_POST_TOOL_NAME = "generate_visual_post";
export const GENERATE_TEXT_POST_TOOL_NAME = "generate_text_post";

export const generateVideoScriptTool: LlmToolDefinition = {
  name: GENERATE_VIDEO_SCRIPT_TOOL_NAME,
  description: "Renvoie une fiche de tournage vidéo complète et prête à filmer, structurée selon le format attendu.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Titre du concept, clair sur l'objectif du contenu." },
      hookVisual: { type: "string", description: "Description du visuel des 3 premières secondes (l'accroche)." },
      hookText: { type: "string", description: "Texte à afficher à l'écran pendant l'accroche." },
      hookAudio: { type: "string", description: "Ce qui est dit ou entendu pendant l'accroche (voix/audio)." },
      storyboard: {
        type: "array",
        description: "Découpage en plans simples et numérotés.",
        items: {
          type: "object",
          properties: {
            planNumber: { type: "integer" },
            description: { type: "string" },
          },
          required: ["planNumber", "description"],
        },
      },
      caption: { type: "string", description: "Légende rédigée selon les règles SEO de la plateforme visée." },
      hashtags: { type: "array", description: "Liste de hashtags pertinents pour la plateforme visée.", items: { type: "string" } },
      soundRecommendation: { type: "string", description: "Recommandation de musique/audio/tendance à associer." },
    },
    required: ["title", "hookVisual", "hookText", "hookAudio", "storyboard", "caption", "hashtags", "soundRecommendation"],
  },
};

export const generateVisualPostTool: LlmToolDefinition = {
  name: GENERATE_VISUAL_POST_TOOL_NAME,
  description:
    "Renvoie un post visuel statique complet (image unique ou carrousel), sans vidéo ni audio, structuré selon le format attendu.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Titre du concept, clair sur l'objectif du contenu." },
      hookVisual: {
        type: "string",
        description: "Description de la composition visuelle qui capte l'attention (image unique, ou 1re slide d'un carrousel).",
      },
      storyboard: {
        type: "array",
        description: "Découpage en slides numérotées si carrousel (une seule entrée si image unique).",
        items: {
          type: "object",
          properties: {
            planNumber: { type: "integer" },
            description: { type: "string" },
          },
          required: ["planNumber", "description"],
        },
      },
      caption: { type: "string", description: "Légende rédigée selon les règles SEO de la plateforme visée." },
      hashtags: { type: "array", description: "Liste de hashtags pertinents pour la plateforme visée.", items: { type: "string" } },
    },
    required: ["title", "hookVisual", "storyboard", "caption", "hashtags"],
  },
};

export const generateTextPostTool: LlmToolDefinition = {
  name: GENERATE_TEXT_POST_TOOL_NAME,
  description: "Renvoie un post texte seul (pas de visuel ni de vidéo), structuré selon le format attendu.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Titre du concept, clair sur l'objectif du contenu." },
      hookText: { type: "string", description: "Première phrase du texte, pensée pour capter l'attention." },
      caption: { type: "string", description: "Corps du texte complet, prêt à publier." },
      hashtags: {
        type: "array",
        description: "Liste de hashtags pertinents pour la plateforme visée (vide si la plateforme n'en utilise pas).",
        items: { type: "string" },
      },
    },
    required: ["title", "hookText", "caption", "hashtags"],
  },
};

export function toolForContentType(contentType: ContentType): LlmToolDefinition {
  if (contentType === "video") return generateVideoScriptTool;
  if (contentType === "visual") return generateVisualPostTool;
  return generateTextPostTool;
}

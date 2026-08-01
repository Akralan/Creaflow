import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const storyboardStepSchema = z.object({
  planNumber: z.number().int().positive(),
  description: z.string().min(1),
});

export const generatedScriptSchema = z.object({
  title: z.string().min(1),
  hookVisual: z.string().min(1),
  hookText: z.string().min(1),
  hookAudio: z.string().min(1),
  storyboard: z.array(storyboardStepSchema).min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).min(1),
  soundRecommendation: z.string().min(1),
});

export type GeneratedScript = z.infer<typeof generatedScriptSchema>;

export const GENERATE_SCRIPT_TOOL_NAME = "generate_script";

export const generateScriptTool: Tool = {
  name: GENERATE_SCRIPT_TOOL_NAME,
  description:
    "Renvoie une fiche de tournage complète et prête à filmer, structurée selon le format attendu.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Titre du concept, clair sur l'objectif du contenu.",
      },
      hookVisual: {
        type: "string",
        description: "Description du visuel des 3 premières secondes (l'accroche).",
      },
      hookText: {
        type: "string",
        description: "Texte à afficher à l'écran pendant l'accroche.",
      },
      hookAudio: {
        type: "string",
        description: "Ce qui est dit ou entendu pendant l'accroche (voix/audio).",
      },
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
      caption: {
        type: "string",
        description: "Légende rédigée selon les règles SEO de la plateforme visée.",
      },
      hashtags: {
        type: "array",
        description: "Liste de hashtags pertinents pour la plateforme visée.",
        items: { type: "string" },
      },
      soundRecommendation: {
        type: "string",
        description: "Recommandation de musique/audio/tendance à associer.",
      },
    },
    required: [
      "title",
      "hookVisual",
      "hookText",
      "hookAudio",
      "storyboard",
      "caption",
      "hashtags",
      "soundRecommendation",
    ],
  },
};

import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import type { ContentType } from "./prompts";

// Annexe A.4 de docs/SPEC_PROMPT_GENERATION_TECH.md — texte à recopier tel quel, identique sur les
// 3 tools de génération.
const CONCEPT_FIELD_DESCRIPTION =
  "À rédiger en premier, avant tous les autres champs : en 1 ou 2 phrases, l'idée unique de ce post, à qui il s'adresse précisément, et ce que cette personne doit retenir ou faire après l'avoir vu. Une vraie décision éditoriale — pas une paraphrase du brief.";

export const storyboardStepSchema = z.object({
  planNumber: z.number().int().positive(),
  description: z.string().min(1),
});

const baseFields = {
  // Première propriété du schéma — l'ordre des propriétés est le mécanisme qui force le LLM à
  // décider l'idée avant de rédiger le reste (docs/SPEC_PROMPT_GENERATION_TECH.md §4.1) : ne pas
  // déplacer. Persisté sur Script.concept par createScriptRecord (scriptService.ts).
  concept: z.string().min(1),
  title: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).min(1),
  // Citations post-génération (docs/SPEC_MATIERE_EDITEUR.md §3) — passages copiés mot pour mot
  // depuis la matière factuelle fournie, utilisés comme base de ce script. `required` côté JSON
  // schema des 3 tools (voir plus bas) : un champ vraiment optionnel est rempli de façon peu
  // fiable par le modèle (observé en usage réel — tantôt absent, tantôt renseigné, mêmes entrées).
  // `.default([])` ici en filet de sécurité si le provider l'omet quand même.
  usedExcerpts: z.array(z.string()).default([]),
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
      concept: { type: "string", description: CONCEPT_FIELD_DESCRIPTION },
      title: { type: "string", description: "Le nom de l'idée, pas du sujet : court, spécifique à ce post, impossible à réutiliser pour un autre." },
      hookVisual: {
        type: "string",
        description:
          "Ce qu'on voit dans les 3 premières secondes : une action ou un objet précis, filmable avec le matériel listé. Pas une intention (\"plan dynamique\") — une image.",
      },
      hookText: { type: "string", description: "Le texte affiché à l'écran : une phrase courte qui crée une tension ou une curiosité. Jamais une annonce du sujet." },
      hookAudio: { type: "string", description: "Ce qui est dit ou entendu pendant l'accroche : prolonge le manque créé par le visuel, ne le répète pas." },
      storyboard: {
        type: "array",
        description: "Découpage en plans simples et numérotés.",
        items: {
          type: "object",
          properties: {
            planNumber: { type: "integer" },
            description: {
              type: "string",
              description: "Une action filmable en un seul plan avec le matériel listé : qui fait quoi, sur quoi. Concret et exécutable, pas une intention.",
            },
          },
          required: ["planNumber", "description"],
          additionalProperties: false,
        },
      },
      caption: { type: "string", description: "Développe l'idée du concept avec les détails de la matière. Un seul appel à l'action, clair, à la fin. Respecte les codes de la plateforme cible." },
      hashtags: {
        type: "array",
        description: "Chaque hashtag sert la découverte du post selon la règle de la plateforme cible (mix large + niche, nombre adapté). Jamais décoratif.",
        items: { type: "string" },
      },
      soundRecommendation: { type: "string", description: "Un type de son, musique ou tendance cohérent avec l'idée et la plateforme, décrit concrètement." },
      usedExcerpts: {
        type: "array",
        description: "OBLIGATOIRE — ne jamais omettre ce champ. Passages copiés MOT POUR MOT depuis la matière factuelle fournie que tu as utilisés comme base de ce script, un par information factuelle reprise. Renvoie un tableau vide [] si aucune matière ne t'a été fournie ou si tu n'en as repris aucun passage mot pour mot.",
        items: { type: "string" },
      },
    },
    required: ["concept", "title", "hookVisual", "hookText", "hookAudio", "storyboard", "caption", "hashtags", "soundRecommendation", "usedExcerpts"],
    additionalProperties: false,
  },
};

// Note d'implémentation : l'Annexe A.5 de docs/SPEC_PROMPT_GENERATION_TECH.md liste `hookText` comme
// applicable à "video, visual", mais §4.2 ne décrit que des réécritures de description sur des champs
// existants et ce tool n'a jamais eu de champ hookText séparé (le texte à l'écran d'un post visuel
// fait partie de hookVisual/storyboard[].description). Interprété ici comme un ajout de champ hors
// périmètre d'une passe "descriptions qualitatives" — non ajouté ; à trancher explicitement si besoin.
export const generateVisualPostTool: LlmToolDefinition = {
  name: GENERATE_VISUAL_POST_TOOL_NAME,
  description:
    "Renvoie un post visuel statique complet (image unique ou carrousel), sans vidéo ni audio, structuré selon le format attendu.",
  input_schema: {
    type: "object",
    properties: {
      concept: { type: "string", description: CONCEPT_FIELD_DESCRIPTION },
      title: { type: "string", description: "Le nom de l'idée, pas du sujet : court, spécifique à ce post, impossible à réutiliser pour un autre." },
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
            description: {
              type: "string",
              description: "Le contenu d'une slide : ce qu'on voit et le texte affiché, au service de l'idée du concept.",
            },
          },
          required: ["planNumber", "description"],
          additionalProperties: false,
        },
      },
      caption: { type: "string", description: "Développe l'idée du concept avec les détails de la matière. Un seul appel à l'action, clair, à la fin. Respecte les codes de la plateforme cible." },
      hashtags: {
        type: "array",
        description: "Chaque hashtag sert la découverte du post selon la règle de la plateforme cible (mix large + niche, nombre adapté). Jamais décoratif.",
        items: { type: "string" },
      },
      usedExcerpts: {
        type: "array",
        description: "OBLIGATOIRE — ne jamais omettre ce champ. Passages copiés MOT POUR MOT depuis la matière factuelle fournie que tu as utilisés comme base de ce script, un par information factuelle reprise. Renvoie un tableau vide [] si aucune matière ne t'a été fournie ou si tu n'en as repris aucun passage mot pour mot.",
        items: { type: "string" },
      },
    },
    required: ["concept", "title", "hookVisual", "storyboard", "caption", "hashtags", "usedExcerpts"],
    additionalProperties: false,
  },
};

export const generateTextPostTool: LlmToolDefinition = {
  name: GENERATE_TEXT_POST_TOOL_NAME,
  description: "Renvoie un post texte seul (pas de visuel ni de vidéo), structuré selon le format attendu.",
  input_schema: {
    type: "object",
    properties: {
      concept: { type: "string", description: CONCEPT_FIELD_DESCRIPTION },
      title: { type: "string", description: "Le nom de l'idée, pas du sujet : court, spécifique à ce post, impossible à réutiliser pour un autre." },
      hookText: { type: "string", description: "La première phrase du texte : elle crée un manque qui oblige à lire la deuxième." },
      caption: { type: "string", description: "Développe l'idée du concept avec les détails de la matière. Un seul appel à l'action, clair, à la fin. Respecte les codes de la plateforme cible." },
      hashtags: {
        type: "array",
        description: "Chaque hashtag sert la découverte du post selon la règle de la plateforme cible (mix large + niche, nombre adapté). Jamais décoratif. Vide si la plateforme n'en utilise pas.",
        items: { type: "string" },
      },
      usedExcerpts: {
        type: "array",
        description: "OBLIGATOIRE — ne jamais omettre ce champ. Passages copiés MOT POUR MOT depuis la matière factuelle fournie que tu as utilisés comme base de ce script, un par information factuelle reprise. Renvoie un tableau vide [] si aucune matière ne t'a été fournie ou si tu n'en as repris aucun passage mot pour mot.",
        items: { type: "string" },
      },
    },
    required: ["concept", "title", "hookText", "caption", "hashtags", "usedExcerpts"],
    additionalProperties: false,
  },
};

export function toolForContentType(contentType: ContentType): LlmToolDefinition {
  if (contentType === "video") return generateVideoScriptTool;
  if (contentType === "visual") return generateVisualPostTool;
  return generateTextPostTool;
}

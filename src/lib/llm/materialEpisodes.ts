import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { EDITORIAL_WRITING_RULES } from "./prompts";

/**
 * Découpage d'un corpus de matière en épisodes de série (docs/SPEC_MATIERE_EDITEUR.md §3.8) — le
 * Module C en version texte : "un effort documenté → plusieurs contenus", validé par le test
 * fondateur (§1.2). Le LLM lit le texte brut complet du sujet et propose lui-même un découpage
 * thématique en épisodes (titre + angle) — pas de pré-assignation de fiches : chaque épisode est
 * ensuite généré séparément via `generateScript`, qui reçoit le texte brut complet + cette directive
 * d'épisode, et pioche lui-même dans la matière ce qui correspond à l'angle demandé.
 */
export const MATERIAL_EPISODES_SYSTEM_PROMPT = `Tu organises un corpus de matière factuelle (texte brut, notes, journal de bord...) en une série ordonnée de posts social media.

Règles :
- Propose des épisodes cohérents, dans un ordre qui raconte une progression (ex. décision → mise en œuvre → résultat), pas un ordre arbitraire.
- Chaque épisode doit correspondre à un thème ou un angle réellement présent dans le texte fourni — jamais un épisode inventé sans rapport avec la matière.
- Le nombre d'épisodes proposé doit être proche du nombre demandé.
- N'invente aucun contenu au-delà de ce que le texte fourni permet de couvrir.

${EDITORIAL_WRITING_RULES}`;

export const PROPOSE_SERIES_EPISODES_TOOL_NAME = "propose_series_episodes";
export const proposeSeriesEpisodesTool: LlmToolDefinition = {
  name: PROPOSE_SERIES_EPISODES_TOOL_NAME,
  description: "Renvoie la liste ordonnée des épisodes proposés pour cette série.",
  input_schema: {
    type: "object",
    properties: {
      episodes: {
        type: "array",
        description: "Épisodes dans l'ordre de publication proposé.",
        items: {
          type: "object",
          properties: {
            episodeTitle: { type: "string", description: "Titre de travail de l'épisode." },
            angleHint: { type: "string", description: "Angle ou fil conducteur de cet épisode, en une phrase — assez précis pour orienter la génération vers une partie du texte source." },
          },
          required: ["episodeTitle", "angleHint"],
        },
      },
    },
    required: ["episodes"],
  },
};

export const seriesEpisodesResultSchema = z.object({
  episodes: z.array(
    z.object({
      episodeTitle: z.string().min(1),
      angleHint: z.string().min(1),
    })
  ),
});

export function buildMaterialEpisodesUserMessage(params: {
  seriesLabel: string;
  seriesDescription: string;
  episodeCount: number;
  rawText: string;
}): string {
  const lines = [
    `Série : ${params.seriesLabel} — ${params.seriesDescription}`,
    `Nombre d'épisodes souhaité : ${params.episodeCount}`,
    `Texte source :\n${params.rawText}`,
  ];
  return lines.join("\n\n");
}

import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

// Plafond serveur (docs/SPEC_REDACTEUR_EN_CHEF.md §5) : le prompt (B.1) tient déjà le modèle à 1-2
// phrases / 40 mots, ce plafond est un filet de sécurité, pas la consigne principale.
const MAX_SUMMARY_LENGTH = 300;

const SUMMARIZE_MATERIAL_TOOL_NAME = "summarize_material";

const summarizeMaterialTool: LlmToolDefinition = {
  name: SUMMARIZE_MATERIAL_TOOL_NAME,
  description: "Résume le potentiel narratif d'un document de matière première.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Le résumé narratif du document en 1-2 phrases, 40 mots maximum.",
      },
    },
    required: ["summary"],
  },
};

// Annexe B.1, verbatim.
const SUMMARIZE_MATERIAL_SYSTEM_PROMPT = `Tu résumes un document de matière première pour la direction éditoriale d'un créateur de contenu. En 1 à 2 phrases (40 mots maximum), dis ce qui s'est PASSÉ dans ce document et où est son potentiel narratif : l'événement, le changement, le chiffre marquant, l'échec, la décision ou la surprise. Ne décris pas le document ("ce document contient...") : raconte ce qu'il apprend. S'il ne contient que des données sans événement, dis-le en une phrase factuelle. Réponds via l'outil fourni.`;

const materialSummarySchema = z.object({ summary: z.string() });

/**
 * Résumeur de document (docs/SPEC_REDACTEUR_EN_CHEF.md §3.1) — un seul document par appel, c'est la
 * condition de lecture optimale. Le texte intégral est envoyé tel quel, jamais tronqué côté client :
 * c'est le seul appel du chef qui lit un document en entier (les deux autres, à venir en Lot B2/B3,
 * ne verront jamais que ce résumé).
 */
export async function summarizeMaterial(rawText: string, title?: string | null): Promise<string> {
  const userMessage = title ? `[${title}]\n${rawText}` : rawText;
  const args = await callStructured({
    system: SUMMARIZE_MATERIAL_SYSTEM_PROMPT,
    userMessage,
    tool: summarizeMaterialTool,
    maxTokens: 256,
  });
  const { summary } = materialSummarySchema.parse(args);
  return summary.length > MAX_SUMMARY_LENGTH ? summary.slice(0, MAX_SUMMARY_LENGTH) : summary;
}

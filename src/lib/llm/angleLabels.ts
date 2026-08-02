import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

export const angleEntrySchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
});

export type AngleEntry = z.infer<typeof angleEntrySchema>;

export const suggestedAnglesSchema = z.object({
  angles: z.array(angleEntrySchema).min(4).max(8),
});

const SUGGEST_CONTENT_ANGLES_TOOL_NAME = "suggest_content_angles";

const suggestContentAnglesTool: LlmToolDefinition = {
  name: SUGGEST_CONTENT_ANGLES_TOOL_NAME,
  description:
    "Propose entre 4 et 8 angles/archétypes de hook réutilisables, adaptés au métier du créateur, pour varier la structure des scripts générés.",
  input_schema: {
    type: "object",
    properties: {
      angles: {
        type: "array",
        description:
          "Liste de 4 à 8 angles : des STRUCTURES de script réutilisables (ex: question choc, avant/après, mythe vs réalité, témoignage, tutoriel, coulisses), pas des sujets ni des catégories de contenu.",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Nom court de l'angle (2-4 mots max)." },
            description: {
              type: "string",
              description: "Guidance en une phrase pour exécuter ce script selon cet angle précis.",
            },
          },
          required: ["label", "description"],
        },
      },
    },
    required: ["angles"],
  },
};

const SYSTEM_PROMPT = `Tu conçois une bibliothèque d'angles de script réutilisables pour un créateur ou une entreprise, adaptée précisément à son activité.

Propose entre 4 et 8 angles : ce sont des ARCHÉTYPES DE STRUCTURE/HOOK (ex: question choc, avant/après, mythe vs réalité, témoignage client, tutoriel pas-à-pas, coulisses, comparaison, storytelling personnel), pas des sujets de contenu ni des catégories éditoriales. Ces angles seront réutilisés à chaque génération pour varier la façon dont un script accroche et se structure, indépendamment du sujet traité. Adapte les libellés et descriptions au métier décrit plutôt que de reprendre une liste générique telle quelle.`;

export interface AngleLabelsContext {
  brandName: string;
  activityType: string;
  tone?: string | null;
  values?: string | null;
  products: Array<{ name: string; description?: string | null }>;
}

export async function suggestContentAngles(context: AngleLabelsContext): Promise<AngleEntry[]> {
  const lines = [
    `Marque : ${context.brandName} (${context.activityType})`,
    context.tone ? `Ton : ${context.tone}` : null,
    context.values ? `Valeurs : ${context.values}` : null,
    context.products.length > 0
      ? `Produits/projets : ${context.products.map((p) => p.name + (p.description ? ` — ${p.description}` : "")).join(" ; ")}`
      : "Aucun produit renseigné.",
  ].filter(Boolean);

  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: lines.join("\n"),
    tool: suggestContentAnglesTool,
    maxTokens: 1024,
  });

  const parsed = suggestedAnglesSchema.parse(args);
  return parsed.angles;
}

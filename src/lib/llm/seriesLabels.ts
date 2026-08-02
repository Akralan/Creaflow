import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

export const seriesEntrySchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(0).max(60),
  categoryLabels: z.array(z.string().min(1)).min(1),
});

export type SeriesEntry = z.infer<typeof seriesEntrySchema>;

export const suggestedSeriesSchema = z.object({
  series: z.array(seriesEntrySchema).min(0).max(5),
});

const SUGGEST_CONTENT_SERIES_TOOL_NAME = "suggest_content_series";

const suggestContentSeriesTool: LlmToolDefinition = {
  name: SUGGEST_CONTENT_SERIES_TOOL_NAME,
  description:
    "Propose entre 0 et 5 séries de contenu récurrentes (formats nommés, reconnaissables) adaptées au métier du créateur, chacune rattachée à une ou plusieurs de ses catégories de contenu actives.",
  input_schema: {
    type: "object",
    properties: {
      series: {
        type: "array",
        description:
          "Liste de 0 à 5 séries récurrentes (ex: \"Le mythe du mercredi\", \"Behind the scenes du vendredi\", \"Témoignage client\"). Si le métier ne s'y prête vraiment pas, renvoie une liste vide plutôt que d'inventer une série artificielle.",
        minItems: 0,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Nom court et mémorable de la série (3-5 mots max)." },
            description: {
              type: "string",
              description: "Identité de la série en une ou deux phrases : angle, ton, structure à respecter à chaque script de cette série.",
            },
            weight: {
              type: "integer",
              description: "Pourcentage approximatif des créneaux mensuels que cette série devrait occuper (0 à 60, pas besoin de sommer à 100 avec les autres séries).",
            },
            categoryLabels: {
              type: "array",
              description: "Libellés EXACTS d'une ou plusieurs catégories de contenu actives (fournies dans le contexte) auxquelles cette série appartient.",
              items: { type: "string" },
            },
          },
          required: ["label", "description", "weight", "categoryLabels"],
        },
      },
    },
    required: ["series"],
  },
};

const SYSTEM_PROMPT = `Tu conçois la direction éditoriale d'un créateur ou d'une entreprise, adaptée précisément à son activité.

Propose entre 0 et 5 "séries" : des formats de contenu récurrents et nommés (ex: pour un coach sportif : "Le mythe du mercredi" en éducatif, "Transformation du mois" en témoignage ; pour un freelance produit web : "Build in public hebdo" en coulisses). Une série donne une identité reconnaissable (même angle, même structure, même ton à chaque publication) et peut piocher dans une ou plusieurs catégories de contenu déjà définies par l'utilisateur — utilise leurs libellés EXACTS tels que fournis. N'invente pas de série artificielle si le métier ne s'y prête pas : une liste vide est un résultat parfaitement valide. Le poids de chaque série est un pourcentage approximatif des créneaux mensuels (0 à 60), sans obligation de sommer à 100 — une partie du calendrier reste hors série.`;

export interface SeriesLabelsContext {
  brandName: string;
  activityType: string;
  tone?: string | null;
  values?: string | null;
  products: Array<{ name: string; description?: string | null }>;
  categories: Array<{ label: string; description: string }>;
}

export async function suggestContentSeries(context: SeriesLabelsContext): Promise<SeriesEntry[]> {
  const lines = [
    `Marque : ${context.brandName} (${context.activityType})`,
    context.tone ? `Ton : ${context.tone}` : null,
    context.values ? `Valeurs : ${context.values}` : null,
    context.products.length > 0
      ? `Produits/projets : ${context.products.map((p) => p.name + (p.description ? ` — ${p.description}` : "")).join(" ; ")}`
      : "Aucun produit renseigné.",
    `Catégories de contenu actives : ${context.categories.map((c) => `${c.label} — ${c.description}`).join(" ; ")}`,
  ].filter(Boolean);

  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: lines.join("\n"),
    tool: suggestContentSeriesTool,
    maxTokens: 1536,
  });

  const parsed = suggestedSeriesSchema.parse(args);
  return parsed.series;
}

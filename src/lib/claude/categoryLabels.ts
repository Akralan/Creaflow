import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { getClaudeClient, CLAUDE_MODEL } from "./client";

const categoryEntrySchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(5).max(90),
});

export const categoryLabelsSchema = z.object({
  vente: categoryEntrySchema,
  coulisses: categoryEntrySchema,
  educatif: categoryEntrySchema,
});

export type CategoryLabels = z.infer<typeof categoryLabelsSchema>;

const SUGGEST_CATEGORY_LABELS_TOOL_NAME = "suggest_category_labels";

const suggestCategoryLabelsTool: Tool = {
  name: SUGGEST_CATEGORY_LABELS_TOOL_NAME,
  description:
    "Adapte la terminologie des 3 catégories du plan de contenu (promotionnel / coulisses-humain / apport de valeur) au métier précis du créateur.",
  input_schema: {
    type: "object",
    properties: {
      vente: {
        type: "object",
        description:
          "Catégorie promotionnelle — met en avant une offre, un produit, un lancement, une annonce. Garde cet esprit même si 'vente' au sens propre ne s'applique pas (ex: personal branding).",
        properties: {
          label: { type: "string", description: "Libellé court affiché dans l'app (2-3 mots max)." },
          description: { type: "string", description: "Guidance en une phrase pour orienter la génération de scripts de cette catégorie." },
          weight: { type: "integer", description: "Pourcentage cible dans le mix mensuel (5 à 90)." },
        },
        required: ["label", "description", "weight"],
      },
      coulisses: {
        type: "object",
        description: "Catégorie coulisses/storytelling/connexion humaine — montre le processus ou la personne derrière l'activité.",
        properties: {
          label: { type: "string" },
          description: { type: "string" },
          weight: { type: "integer" },
        },
        required: ["label", "description", "weight"],
      },
      educatif: {
        type: "object",
        description: "Catégorie éducative/valeur ajoutée/tendance — apprend ou divertit sans vendre directement.",
        properties: {
          label: { type: "string" },
          description: { type: "string" },
          weight: { type: "integer" },
        },
        required: ["label", "description", "weight"],
      },
    },
    required: ["vente", "coulisses", "educatif"],
  },
};

const SYSTEM_PROMPT = `Tu adaptes la terminologie d'un plan de contenu social media au métier précis d'un créateur.

Le plan repose sur 3 catégories universelles :
- Une catégorie promotionnelle (par défaut "Vente") : met en avant une offre, un produit, un lancement.
- Une catégorie coulisses (par défaut "Coulisses") : montre le processus, la personne, l'humain derrière l'activité.
- Une catégorie éducative (par défaut "Éducatif") : apporte de la valeur, enseigne, divertit, sans vendre directement.

Pour chaque catégorie, propose un libellé court et un pourcentage cible du mix mensuel adaptés à l'activité décrite — le mix par défaut est 30% promotionnel / 50% coulisses / 20% éducatif, mais ajuste-le si l'activité s'y prête mieux (les 3 poids doivent rester réalistes, entre 5 et 90, sans obligation de sommer exactement à 100 — l'application normalise). N'invente pas une 4e catégorie : les 3 rôles doivent rester couverts, seul le vocabulaire et le poids changent.`;

export function normalizeCategoryWeights(labels: CategoryLabels): CategoryLabels {
  const total = labels.vente.weight + labels.coulisses.weight + labels.educatif.weight;
  if (total === 100) return labels;

  const scale = 100 / total;
  const scaled = {
    vente: Math.round(labels.vente.weight * scale),
    coulisses: Math.round(labels.coulisses.weight * scale),
    educatif: Math.round(labels.educatif.weight * scale),
  };
  const diff = 100 - (scaled.vente + scaled.coulisses + scaled.educatif);
  scaled.coulisses += diff; // absorbe l'arrondi sur la catégorie généralement majoritaire

  return {
    vente: { ...labels.vente, weight: scaled.vente },
    coulisses: { ...labels.coulisses, weight: scaled.coulisses },
    educatif: { ...labels.educatif, weight: scaled.educatif },
  };
}

export interface CategoryLabelsContext {
  brandName: string;
  activityType: string;
  tone?: string | null;
  values?: string | null;
  products: Array<{ name: string; description?: string | null }>;
}

export async function suggestCategoryLabels(context: CategoryLabelsContext): Promise<CategoryLabels> {
  const client = getClaudeClient();

  const lines = [
    `Marque : ${context.brandName} (${context.activityType})`,
    context.tone ? `Ton : ${context.tone}` : null,
    context.values ? `Valeurs : ${context.values}` : null,
    context.products.length > 0
      ? `Produits/projets : ${context.products.map((p) => p.name + (p.description ? ` — ${p.description}` : "")).join(" ; ")}`
      : "Aucun produit renseigné.",
  ].filter(Boolean);

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [suggestCategoryLabelsTool],
    tool_choice: { type: "tool", name: SUGGEST_CATEGORY_LABELS_TOOL_NAME },
    messages: [{ role: "user", content: lines.join("\n") }],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Claude n'a pas renvoyé de catégories structurées.");
  }

  return normalizeCategoryWeights(categoryLabelsSchema.parse(toolUse.input));
}

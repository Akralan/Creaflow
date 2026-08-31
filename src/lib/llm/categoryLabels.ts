import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

export const categoryEntrySchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(5).max(90),
});

export type CategoryEntry = z.infer<typeof categoryEntrySchema>;

export const suggestedCategoriesSchema = z.object({
  categories: z.array(categoryEntrySchema).min(2).max(6),
});

const SUGGEST_CONTENT_CATEGORIES_TOOL_NAME = "suggest_content_categories";

const suggestContentCategoriesTool: LlmToolDefinition = {
  name: SUGGEST_CONTENT_CATEGORIES_TOOL_NAME,
  description:
    "Propose entre 2 et 6 rôles éditoriaux (catégories de contenu) adaptés au métier précis du créateur, pour structurer son mix de publication.",
  input_schema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        description:
          "Liste de 2 à 6 catégories de contenu, chacune avec un rôle distinct dans la stratégie (ex: promotionnel, coulisses/humain, éducatif/valeur, actualité, retours d'expérience... adapte entièrement les rôles au métier décrit, n'impose aucun triptyque fixe).",
        minItems: 2,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Libellé court affiché dans l'app (2-3 mots max)." },
            description: {
              type: "string",
              description: "Guidance en une phrase pour orienter la génération de scripts de cette catégorie.",
            },
            weight: { type: "integer", description: "Pourcentage cible dans le mix mensuel (5 à 90)." },
          },
          required: ["label", "description", "weight"],
        },
      },
    },
    required: ["categories"],
  },
};

const SYSTEM_PROMPT = `Tu conçois le plan de contenu social media d'un créateur ou d'une entreprise, adapté précisément à son activité.

Propose entre 2 et 6 catégories de contenu qui structureront son mix de publication mensuel. Les catégories doivent couvrir des rôles complémentaires et distincts (ex: pour un artisan : promotionnel / coulisses / éducatif ; pour un freelance produit web : build in public / retours d'expérience / astuces techniques / annonces produit — adapte entièrement le nombre et les rôles au métier décrit, n'impose aucun triptyque fixe). Pour chaque catégorie, propose un libellé court et un pourcentage cible réaliste (entre 5 et 90, sans obligation de sommer exactement à 100 — l'application normalise).`;

export function normalizeCategoryWeights(categories: CategoryEntry[]): CategoryEntry[] {
  const total = categories.reduce((sum, c) => sum + c.weight, 0);
  if (total === 100) return categories;

  const scale = 100 / total;
  const scaled = categories.map((c) => ({ ...c, weight: Math.round(c.weight * scale) }));
  const diff = 100 - scaled.reduce((sum, c) => sum + c.weight, 0);

  const maxIndex = scaled.reduce((best, c, i) => (c.weight > scaled[best].weight ? i : best), 0);
  scaled[maxIndex] = { ...scaled[maxIndex], weight: scaled[maxIndex].weight + diff };

  return scaled;
}

export interface CategoryLabelsContext {
  brandName: string;
  activityType: string;
  tone?: string | null;
  values?: string | null;
  products: Array<{ name: string; description?: string | null }>;
}

export async function suggestContentCategories(context: CategoryLabelsContext): Promise<CategoryEntry[]> {
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
    tool: suggestContentCategoriesTool,
    maxTokens: 1024,
  });

  const parsed = suggestedCategoriesSchema.parse(args);
  return normalizeCategoryWeights(parsed.categories);
}

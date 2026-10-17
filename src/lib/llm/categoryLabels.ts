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
    "Proposes between 2 and 6 editorial roles (content categories) suited to the creator's precise trade, to structure their publishing mix. All text in English.",
  input_schema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        description:
          "List of 2 to 6 content categories, each with a distinct role in the strategy (e.g. promotional, behind the scenes/human, educational/value, news, lessons learned... adapt the roles entirely to the described trade, impose no fixed triad).",
        minItems: 2,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short label shown in the app (2-3 words max)." },
            description: {
              type: "string",
              description: "One-sentence guidance to steer the script generation of this category.",
            },
            weight: { type: "integer", description: "Target percentage in the monthly mix (5 to 90)." },
          },
          required: ["label", "description", "weight"],
        },
      },
    },
    required: ["categories"],
  },
};

const SYSTEM_PROMPT = `You design the social media content plan of a creator or a company, tailored precisely to their activity.

Propose between 2 and 6 content categories that will structure their monthly publishing mix. The categories must cover complementary, distinct roles (e.g. for a craftsperson: promotional / behind the scenes / educational; for a freelance web product maker: build in public / lessons learned / technical tips / product announcements — adapt the number and the roles entirely to the described trade, impose no fixed triad). For each category, propose a short label and a realistic target percentage (between 5 and 90, no obligation to sum exactly to 100 — the application normalizes). Write everything in English.`;

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
  expectations?: string | null;
  products: Array<{ name: string; description?: string | null }>;
}

export async function suggestContentCategories(context: CategoryLabelsContext): Promise<CategoryEntry[]> {
  const lines = [
    `Brand: ${context.brandName} (${context.activityType})`,
    context.expectations ? `What the author expects from Tellovo: ${context.expectations}` : null,
    context.products.length > 0
      ? `Products/projects: ${context.products.map((p) => p.name + (p.description ? ` — ${p.description}` : "")).join("; ")}`
      : "No product registered.",
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

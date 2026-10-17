import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

export const seriesEntrySchema = z.object({
  label: z.string().min(1),
  description: z.string().min(1),
  // A single role per series (docs/SPEC_SERIES_ET_ROLES.md §1) — exact label of an active role.
  categoryLabel: z.string().min(1),
  // Subject the series draws its material from — empty string = brand level. Before 2026-10-17
  // generated series were born without a subject, hence without material or reader portrait.
  subjectName: z.string().default(""),
});

export type SeriesEntry = z.infer<typeof seriesEntrySchema>;

export const suggestedSeriesSchema = z.object({
  series: z.array(seriesEntrySchema).min(0).max(5),
});

const SUGGEST_CONTENT_SERIES_TOOL_NAME = "suggest_content_series";

/** The enum on categoryLabel forces the model to pick among the existing labels as
 *  they are, instead of copying the "Label — Description" block supplied in context. */
function buildSuggestContentSeriesTool(categoryLabels: string[], subjectNames: string[]): LlmToolDefinition {
  return {
    name: SUGGEST_CONTENT_SERIES_TOOL_NAME,
    description:
      "Proposes between 0 and 5 recurring content series (named, recognizable formats) suited to the creator's trade, each serving ONE active editorial role. All text in English.",
    input_schema: {
      type: "object",
      properties: {
        series: {
          type: "array",
          description:
            "List of 0 to 5 recurring series (e.g. \"Myth-busting Wednesday\", \"Behind the scenes Friday\", \"Customer story\"), from most to least important for this creator. If the trade really doesn't lend itself to it, return an empty list rather than invent an artificial series.",
          minItems: 0,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Short, memorable name of the series (3-5 words max)." },
              description: {
                type: "string",
                description: "Identity of the series in one or two sentences: angle, tone, structure to respect in every script of this series.",
              },
              categoryLabel: {
                type: "string",
                description: "The (single) editorial role this series serves. If in doubt between two roles, they are two series.",
                enum: categoryLabels,
              },
              subjectName: {
                type: "string",
                enum: [...subjectNames, ""],
                description:
                  "The project whose progress the series tells or from which it draws its material, copied from those supplied. Empty string only if the series is about the activity in general and no specific project.",
              },
            },
            required: ["label", "description", "categoryLabel", "subjectName"],
          },
        },
      },
      required: ["series"],
    },
  };
}

const SYSTEM_PROMPT = `You design the editorial direction of a creator or a company, tailored precisely to their activity.

Propose between 0 and 5 "series": recurring, named content formats (e.g. for a fitness coach: "Myth-busting Wednesday" as educational, "Transformation of the month" as testimonial; for a freelance web product maker: "Weekly build in public" as behind the scenes). A series gives a recognizable identity (same angle, same structure, same tone at every publication) and serves ONE SINGLE editorial role among those already defined for the user — use their EXACT label as supplied. If a series idea hesitates between two roles, it means there are two series: split it. Don't invent an artificial series if the trade doesn't lend itself to it: an empty list is a perfectly valid result. Rank the series from most to least important: the author's publishing days are distributed to them in that order. Write everything in English.`;

export interface SeriesLabelsContext {
  brandName: string;
  activityType: string;
  expectations?: string | null;
  products: Array<{ name: string; description?: string | null }>;
  categories: Array<{ label: string; description: string }>;
}

export async function suggestContentSeries(context: SeriesLabelsContext): Promise<SeriesEntry[]> {
  const lines = [
    `Brand: ${context.brandName} (${context.activityType})`,
    context.expectations ? `What the author expects from Tellovo: ${context.expectations}` : null,
    context.products.length > 0
      ? `Products/projects: ${context.products.map((p) => p.name + (p.description ? ` — ${p.description}` : "")).join("; ")}`
      : "No product registered.",
    `Active editorial roles: ${context.categories.map((c) => `${c.label} — ${c.description}`).join("; ")}`,
  ].filter(Boolean);

  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: lines.join("\n"),
    tool: buildSuggestContentSeriesTool(
      context.categories.map((c) => c.label),
      context.products.map((p) => p.name)
    ),
    maxTokens: 1536,
  });

  const parsed = suggestedSeriesSchema.parse(args);
  return parsed.series;
}

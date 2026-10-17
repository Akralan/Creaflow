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
    "Proposes between 4 and 8 reusable angles/hook archetypes, suited to the creator's trade, to vary the structure of the generated scripts. All text in English.",
  input_schema: {
    type: "object",
    properties: {
      angles: {
        type: "array",
        description:
          "List of 4 to 8 angles: reusable script STRUCTURES (e.g. shock opener, before/after, myth vs reality, testimonial, tutorial, behind the scenes), not subjects or content categories.",
        minItems: 4,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short name of the angle (2-4 words max)." },
            description: {
              type: "string",
              description: "One-sentence guidance to carry out this script along this precise angle.",
            },
          },
          required: ["label", "description"],
        },
      },
    },
    required: ["angles"],
  },
};

const SYSTEM_PROMPT = `You design a library of reusable script angles for a creator or a company, tailored precisely to their activity.

Propose between 4 and 8 angles: these are STRUCTURE/HOOK ARCHETYPES (e.g. shock opener, before/after, myth vs reality, customer testimonial, step-by-step tutorial, behind the scenes, comparison, personal storytelling), not content subjects or editorial categories. These angles will be reused at each generation to vary how a script hooks and is structured, independently of the subject treated. Adapt the labels and descriptions to the described trade rather than reusing a generic list as is. Write everything in English.`;

export interface AngleLabelsContext {
  brandName: string;
  activityType: string;
  expectations?: string | null;
  products: Array<{ name: string; description?: string | null }>;
}

export async function suggestContentAngles(context: AngleLabelsContext): Promise<AngleEntry[]> {
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
    tool: suggestContentAnglesTool,
    maxTokens: 1024,
  });

  const parsed = suggestedAnglesSchema.parse(args);
  return parsed.angles;
}

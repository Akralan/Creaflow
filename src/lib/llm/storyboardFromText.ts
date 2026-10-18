import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { expectedStoryboardRange, type VisualFormatSpec } from "@/lib/visualDesign/visualFormat";

/**
 * The visual of an already written post (docs/SPEC_APP_DESIGN_TELLOVO.md E16): the text stays as it is, and
 * this call reads it to write what the image shows — the idea of the visual and one description per
 * slide, in the shape the mockup composer expects (the one a visual post gets at generation).
 */
export interface StoryboardFromTextInput {
  platform: string;
  title: string | null;
  text: string;
  spec: VisualFormatSpec;
}

export const storyboardFromTextSchema = z.object({
  hookVisual: z.string().min(1),
  storyboard: z.array(z.object({ planNumber: z.number().int().positive(), description: z.string().min(1) })).min(1),
});

export type VisualBrief = z.infer<typeof storyboardFromTextSchema>;

const TOOL: LlmToolDefinition = {
  name: "write_visual_brief",
  description: "Writes the brief of the visual that goes with a finished post.",
  input_schema: {
    type: "object",
    properties: {
      hookVisual: { type: "string", description: "What the visual shows at first glance, in one sentence: the thing that makes someone stop scrolling." },
      storyboard: {
        type: "array",
        description: "One entry per slide, in order.",
        items: {
          type: "object",
          properties: {
            planNumber: { type: "integer", description: "1 for the first slide, then 2, 3…" },
            description: { type: "string", description: "What this slide shows: the words on screen (short, taken from the post) and the composition around them." },
          },
          required: ["planNumber", "description"],
        },
      },
    },
    required: ["hookVisual", "storyboard"],
  },
};

const SYSTEM_PROMPT = `You design the visual that goes with a social media post someone has already written and approved. You never change the post: you illustrate it.

Rules:
- Take everything from the post: the words on screen are its own words, shortened. Invent no number, name or claim the post does not make.
- Write the words on screen in the language of the post.
- Short words beat long ones: a slide carries one idea, a few words, never a paragraph.
- The first slide stops the scroll: the sharpest line of the post, or its most concrete detail.
- Describe the content and the composition (what is big, what is small, what comes first), not colors or fonts: the designer picks those.`;

function formatLine(spec: VisualFormatSpec): string {
  const { min, max } = expectedStoryboardRange(spec);
  if (spec.format === "carousel") return `A carousel of exactly ${spec.slideCount} slides. Each slide moves the story forward; the last one closes it.`;
  if (spec.format === "animation") {
    return `An animation of ${Math.round((spec.durationMs ?? 8000) / 1000)} seconds on one screen: between ${min} and ${max} moments of text that appear one after the other. Each entry of the storyboard is one moment.`;
  }
  return "A single image: exactly one entry in the storyboard.";
}

export function buildVisualBriefMessage(input: StoryboardFromTextInput): string {
  return [
    `Platform: ${input.platform}`,
    input.title ? `Title: ${input.title}` : null,
    `Format: ${formatLine(input.spec)}`,
    "",
    "=== POST ===",
    input.text,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/** Keeps the storyboard to the size the format asks for and numbers it from 1. */
export function fitStoryboard(brief: VisualBrief, spec: VisualFormatSpec): VisualBrief {
  const { min, max } = expectedStoryboardRange(spec);
  const steps = [...brief.storyboard].sort((a, b) => a.planNumber - b.planNumber).slice(0, max);
  if (steps.length < min) throw new Error(`The visual brief has ${steps.length} slides, expected ${min === max ? min : `${min} to ${max}`}.`);
  return { hookVisual: brief.hookVisual.trim(), storyboard: steps.map((s, i) => ({ planNumber: i + 1, description: s.description.trim() })) };
}

export async function storyboardFromText(input: StoryboardFromTextInput): Promise<VisualBrief> {
  const message = buildVisualBriefMessage(input);
  let lastError: unknown = null;
  // A second attempt when the count is off: the model sometimes gives one slide too few.
  for (let attempt = 0; attempt < 2; attempt++) {
    const args = await callStructured({
      system: SYSTEM_PROMPT,
      userMessage: attempt === 0 || !lastError ? message : `${message}\n\nYour previous answer was refused: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      tool: TOOL,
      maxTokens: 1500,
    });
    try {
      return fitStoryboard(storyboardFromTextSchema.parse(args), input.spec);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The visual brief could not be written.");
}

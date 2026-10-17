import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import type { ContentType } from "./prompts";
import { EDITORIAL_WRITING_RULES } from "./prompts";
import { storyboardStepSchema } from "./scriptSchema";

/**
 * Micro-edits in the editor (docs/SPEC_MATIERE_EDITEUR.md §4.4/§4.6): two actions, no more —
 * selection→instruction (rewrite_selection) and single-block regeneration (regenerate_*). Each
 * stays a short, constrained text LLM call, never a regeneration of the whole structure.
 */

export const REWRITE_SELECTION_SYSTEM_PROMPT = `You are a writer who edits existing text on request, for Tellovo.

Rules:
- You rewrite ONLY the selected passage, provided below — never the rest of the script.
- Apply the given instruction, nothing else.
- Keep the language, tone and format of the original text unless the instruction explicitly asks to change them. Posts are written in English.
- If the instruction asks to delete/remove/cut the passage: return an EMPTY string. Don't rephrase it, don't shorten it, don't summarize it — deleting means nothing of that passage should remain, not a shorter version.
- Factual material about the subject may be provided below (documents uploaded by the user) — use it if the instruction asks or suggests it (e.g. "base it on...", "talk about... instead"), copied WORD FOR WORD for any factual information reused.
- You must NEVER invent factual information (name, number, date, anecdote, result...) that was not explicitly given to you — neither in the original text nor in the supplied material. If a detail is missing, literally write "[to be completed]" rather than invent it.
- Return only the replacement text via the provided tool, without quotation marks or comments around it.
- The tool's "usedExcerpts" field is mandatory: return an empty array [] if you reused no passage word for word from the supplied material.

${EDITORIAL_WRITING_RULES}`;

// Annex A.6 of docs/SPEC_PROMPT_GENERATION_TECH.md — context line added to the message of the
// regenerate_* tools (hook/storyboard/hashtags/caption), never to rewrite_selection (§4.3:
// selection→instruction does not receive the concept). Empty string if the script has no concept
// (origin manual/imported, or a script predating migration §2) — to be added with a separator,
// never glued on without checking the length.
export function buildConceptContextLine(concept: string | null): string {
  if (!concept) return "";
  return `Script intent (the regenerated block must stay consistent with it): ${concept}`;
}

export const REWRITE_SELECTION_TOOL_NAME = "rewrite_selection";

/**
 * `includeTitle=false` only when the edited selection IS already the title itself
 * (`blockField === "title"`, microEditService.ts) — asking again for a separate title in that
 * specific case would be redundant with `rewrittenText` and contradict the "return it unchanged if
 * not concerned" instruction (here it IS concerned, it is the edited field). In all other cases,
 * the title is requested at each edit but reconsidered only if necessary — same convention as the
 * `title` of `regenerate_hook` (contentType "text") further down in this file.
 */
export function buildRewriteSelectionTool(includeTitle: boolean): LlmToolDefinition {
  return {
    name: REWRITE_SELECTION_TOOL_NAME,
    description: "Returns the replacement text for the selection, applying the given instruction.",
    input_schema: {
      type: "object",
      properties: {
        rewrittenText: {
          type: "string",
          description:
            "Replacement text, ready to insert in the exact place of the selection. EMPTY string if the instruction asks to delete this passage — never a rephrasing or a shortcut in place of a real deletion.",
        },
        ...(includeTitle
          ? {
              title: {
                type: "string",
                description:
                  "Title consistent with the script once this edit is applied. Return the current title (supplied in context) UNCHANGED if it still describes the subject well — change it only if the edit makes the post's subject drift significantly, not for a minor rewording.",
              },
            }
          : {}),
        usedExcerpts: {
          type: "array",
          description:
            "REQUIRED — never omit this field. Passages copied WORD FOR WORD from the supplied factual material that you used in this replacement. Empty array [] if no material was supplied or used.",
          items: { type: "string" },
        },
      },
      required: includeTitle ? ["rewrittenText", "title", "usedExcerpts"] : ["rewrittenText", "usedExcerpts"],
      additionalProperties: false,
    },
  };
}

export const rewriteSelectionResultSchema = z.object({
  rewrittenText: z.string(),
  title: z.string().optional(),
  usedExcerpts: z.array(z.string()).default([]),
});

export function buildRewriteSelectionUserMessage(params: {
  brandContext: string;
  /** `=== STYLE ===` block (buildStyleBlock) — the learned rules also apply to a sentence edit
   *  (docs/SPEC_APPRENTISSAGE_STYLE.md §5.4). Empty string if no profile. */
  styleBlock?: string;
  selectedText: string;
  instruction: string;
  currentTitle?: string | null;
  materialDocuments?: Array<{ id: string; title: string | null; annotatedText: string }>;
}): string {
  const lines = [
    params.brandContext,
    params.styleBlock ?? "",
    params.currentTitle ? `Current title: ${params.currentTitle}` : "",
    `Selected passage to edit: "${params.selectedText}"`,
    `Instruction: ${params.instruction}`,
  ];
  if (params.materialDocuments?.length) {
    const combined = params.materialDocuments
      .map((d) => (d.title ? `[${d.title}]\n${d.annotatedText}` : d.annotatedText))
      .join("\n\n---\n\n");
    lines.push(
      `Factual material available on this subject (use it if the instruction asks, WORD FOR WORD for any fact reused):\n${combined}`
    );
  }
  return lines.filter(Boolean).join("\n\n");
}

// --- Single-block regeneration ---

export type MicroEditBlock = "hook" | "storyboard" | "caption" | "hashtags";

export function toolForBlock(block: MicroEditBlock, contentType: ContentType): LlmToolDefinition {
  if (block === "hook") {
    if (contentType === "visual") {
      return {
        name: "regenerate_hook",
        description: "Regenerates only the post's visual hook (composition).",
        input_schema: {
          type: "object",
          properties: {
            hookVisual: { type: "string", description: "Visual composition that grabs attention (1st slide or single image)." },
          },
          required: ["hookVisual"],
        },
      };
    }
    // For a text post, the hook IS the first sentence of the current text (supplied as a fixed
    // reference in the message, see microEditService.ts) — the title is included to stay consistent
    // with that same text, but IF the current title already describes the subject well, return it
    // unchanged rather than change it for the sake of changing (`required` field, never omitted, for
    // reliability — see usedExcerpts in scriptSchema.ts — but the value may stay identical to the current one).
    return {
      name: "regenerate_hook",
      description: "Regenerates the hook (first sentence of the text) consistent with the current text supplied, and adjusts the title only if it no longer matches that text.",
      input_schema: {
        type: "object",
        properties: {
          hookText: { type: "string", description: "First sentence of the current text, designed to grab attention — consistent with this text, not with a former subject." },
          title: {
            type: "string",
            description: "Title consistent with the current text supplied. Return the current title UNCHANGED if it already describes this text well — change it only if the text's real subject no longer matches the current title.",
          },
        },
        required: ["hookText", "title"],
        additionalProperties: false,
      },
    };
  }
  if (block === "storyboard") {
    return {
      name: "regenerate_storyboard",
      description: "Regenerates only the slides of the visual post.",
      input_schema: {
        type: "object",
        properties: {
          storyboard: {
            type: "array",
            description: "Simple, numbered slides.",
            items: {
              type: "object",
              properties: { planNumber: { type: "integer" }, description: { type: "string" } },
              required: ["planNumber", "description"],
            },
          },
        },
        required: ["storyboard"],
      },
    };
  }
  if (block === "caption") {
    return {
      name: "regenerate_caption",
      description: "Regenerates only the script's caption (or body text).",
      input_schema: {
        type: "object",
        properties: { caption: { type: "string", description: "Caption or body text, ready to publish." } },
        required: ["caption"],
      },
    };
  }
  return {
    name: "regenerate_hashtags",
    description: "Regenerates only the list of hashtags.",
    input_schema: {
      type: "object",
      properties: {
        hashtags: { type: "array", description: "List of relevant hashtags for the target platform.", items: { type: "string" } },
      },
      required: ["hashtags"],
    },
  };
}

const blockResultSchemas = {
  hook: z.object({
    hookVisual: z.string().optional(),
    hookText: z.string().optional(),
    // Present only for contentType "text" (see toolForBlock) — the title adjusted if needed.
    title: z.string().optional(),
  }),
  storyboard: z.object({ storyboard: z.array(storyboardStepSchema).min(1) }),
  caption: z.object({ caption: z.string().min(1) }),
  hashtags: z.object({ hashtags: z.array(z.string()) }),
} as const;

export function parseBlockResult(block: MicroEditBlock, args: unknown) {
  return blockResultSchemas[block].parse(args);
}

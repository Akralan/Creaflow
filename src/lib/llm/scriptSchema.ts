import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import type { ContentType } from "./prompts";

// Annex A.4 of docs/SPEC_PROMPT_GENERATION_TECH.md — text to copy as is, identical on the
// 2 generation tools.
const CONCEPT_FIELD_DESCRIPTION =
  "Write this first, before all the other fields: in 1 or 2 sentences, the single idea of this post, exactly who it addresses, and what that person should remember or do after seeing it. A real editorial decision — not a paraphrase of the brief. Written in English.";

// Annex B.6 of docs/SPEC_REDACTEUR_EN_CHEF.md — identical on the 2 generation tools.
const PROMISES_MADE_FIELD_DESCRIPTION =
  'The explicit promises this script makes to the audience ("I\'ll publish the verdict", "next week I\'m testing X"), copied as they appear in the script. Empty array [] if the script makes none.';

export const storyboardStepSchema = z.object({
  planNumber: z.number().int().positive(),
  description: z.string().min(1),
});

const baseFields = {
  // First property of the schema — property order is the mechanism that forces the LLM to
  // decide the idea before writing the rest (docs/SPEC_PROMPT_GENERATION_TECH.md §4.1): do not
  // move. Persisted on Script.concept by createScriptRecord (scriptService.ts).
  concept: z.string().min(1),
  title: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).min(1),
  // Post-generation citations (docs/SPEC_MATIERE_EDITEUR.md §3) — passages copied word for word
  // from the supplied factual material, used as the basis of this script. `required` on the JSON
  // schema of the 2 tools (see below): a truly optional field is filled unreliably by the
  // model (seen in real use — sometimes absent, sometimes set, same inputs).
  // `.default([])` here as a safety net if the provider omits it anyway.
  usedExcerpts: z.array(z.string()).default([]),
  // Annex B.6 (docs/SPEC_REDACTEUR_EN_CHEF.md Lot B3) — `required` on the JSON schema of the 2 tools,
  // same reasoning as usedExcerpts (an optional field is filled unreliably);
  // `.default([])` as a safety net if the provider omits it anyway.
  promisesMade: z.array(z.string()).default([]),
};

export const visualScriptSchema = z.object({
  ...baseFields,
  hookVisual: z.string().min(1),
  storyboard: z.array(storyboardStepSchema).min(1),
});
export type VisualGeneratedScript = z.infer<typeof visualScriptSchema> & { contentType: "visual" };

export const textScriptSchema = z.object({
  ...baseFields,
  hashtags: z.array(z.string()), // empty accepted: some text platforms (newsletter...) don't use any.
  hookText: z.string().min(1),
});
export type TextGeneratedScript = z.infer<typeof textScriptSchema> & { contentType: "text" };

// --- Preparation and review (docs/SPEC_PROMPT_GENERATION_V3.md §3, Annex A.4) ---
// Read separately from the post fields, tolerantly: a provider that omits them must never make a
// generation fail, it only loses the trace.

const pickSchema = z.object({ index: z.number().int(), why: z.string() });

export const generationPrepSchema = z.object({
  reader: z.object({ label: z.string(), knows: z.string().default(""), wants: z.string().default("") }),
  candidateMoments: z
    .array(z.object({ moment: z.string(), excerpt: z.string().default("") }))
    .default([])
    .transform((list) => list.slice(0, 5)),
  chosenMoment: pickSchema,
  hookOptions: z.array(z.object({ kind: z.string(), text: z.string() })).default([]),
  chosenHook: pickSchema,
  // docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3 — references i1…i10 of the inspiration cards.
  inspirationsUsed: z.array(z.string()).default([]),
  inspirationsToDrop: z.array(z.object({ ref: z.string(), why: z.string().default("") })).default([]),
  selfCheck: z.object({
    factsFromMaterial: z.boolean(),
    bannedPhrasesFound: z.array(z.string()).default([]),
    readerTest: z.string(),
    authorTest: z.boolean(),
  }),
});
export type GenerationPrep = z.infer<typeof generationPrepSchema>;

/** Persisted on `scripts.generationTrace`: the preparation, the review and the result of the checks. */
export type GenerationTrace = GenerationPrep & {
  version: 3;
  /** Inspiration cards shown to this generation, to apply the feedback after saving. */
  inspirationsShown?: Array<{ ref: string; id: string }>;
  checks: { failures: string[]; retried: boolean };
};

export type GeneratedScript = (VisualGeneratedScript | TextGeneratedScript) & { trace?: GenerationTrace };

export const GENERATE_VISUAL_POST_TOOL_NAME = "generate_visual_post";
export const GENERATE_TEXT_POST_TOOL_NAME = "generate_text_post";

const pickField = (what: string, list: string, why: string) => ({
  type: "object",
  description: what,
  properties: {
    index: { type: "integer", description: `Its position in ${list}, starting at 0.` },
    why: { type: "string", description: why },
  },
  required: ["index", "why"],
  additionalProperties: false,
});

// Annex A.4 — in this order, before `title`: property order is writing order.
const PREP_FIELDS = {
  reader: {
    type: "object",
    description: "The audience this post targets.",
    properties: {
      label: { type: "string", description: "The name of the audience, taken from the portrait if there is one (e.g. \"Players\")." },
      knows: { type: "string", description: "What this reader already knows about the subject, in one sentence." },
      wants: { type: "string", description: "What they come looking for by reading this post, in one sentence." },
    },
    required: ["label", "knows", "wants"],
    additionalProperties: false,
  },
  candidateMoments: {
    type: "array",
    description: "Up to 5 moments from the material that could interest this reader. Don't invent any to reach a number.",
    items: {
      type: "object",
      properties: {
        moment: { type: "string", description: "The moment in one sentence: what happened." },
        excerpt: {
          type: "string",
          description:
            "The passage from the material, copied word for word, that proves it. Empty string if the moment comes from the brand context or an educational episode.",
        },
      },
      required: ["moment", "excerpt"],
      additionalProperties: false,
    },
  },
  chosenMoment: pickField("The moment you keep.", "candidateMoments", "Why this one, for this reader, in one sentence."),
};

const HOOK_PREP_FIELDS = {
  hookOptions: {
    type: "array",
    description: "2 or 3 candidate hooks, of different types.",
    items: {
      type: "object",
      properties: {
        kind: { type: "string", description: "number | confession | counter-intuitive | before-after | scene | specific-question" },
        text: { type: "string", description: "The complete hook." },
      },
      required: ["kind", "text"],
      additionalProperties: false,
    },
  },
  chosenHook: pickField(
    "The hook you keep.",
    "hookOptions",
    "Why it will stop this reader, in one sentence. The hookText or hookVisual field reuses or refines it."
  ),
  // docs/SPEC_MEMOIRE_ET_VEILLE.md Annexe A.5.
  inspirationsUsed: {
    type: "array",
    description: "The references (i1, i2…) of the inspiration cards you used for form. Empty array if none, or if there is no <inspiration> block.",
    items: { type: "string" },
  },
  inspirationsToDrop: {
    type: "array",
    description:
      "The cards that will never serve this subject (foreign audience, generic advice, off-topic), to be removed. Not those that simply don't serve this post. Empty array if none.",
    items: {
      type: "object",
      properties: {
        ref: { type: "string", description: "The reference (i1, i2…)." },
        why: { type: "string", description: "Why it doesn't serve, in one sentence." },
      },
      required: ["ref", "why"],
      additionalProperties: false,
    },
  },
};

// Last, after promisesMade.
const SELF_CHECK_FIELD = {
  selfCheck: {
    type: "object",
    description: "Your honest review of the post. A flagged miss will be fixed by a new draft.",
    properties: {
      factsFromMaterial: { type: "boolean", description: "True if every fact specific to the author comes from the supplied context." },
      bannedPhrasesFound: {
        type: "array",
        description: "The banned or \"to avoid\" phrasings present in the post, copied out. Empty array if there are none.",
        items: { type: "string" },
      },
      readerTest: {
        type: "string",
        description: "In one sentence, why the target reader would stop on this post. Write exactly \"none\" if you can't find a reason.",
      },
      authorTest: { type: "boolean", description: "True if someone who knows the author would believe they wrote this post themselves." },
    },
    required: ["factsFromMaterial", "bannedPhrasesFound", "readerTest", "authorTest"],
    additionalProperties: false,
  },
};

const PREP_REQUIRED = ["reader", "candidateMoments", "chosenMoment", "concept", "hookOptions", "chosenHook", "inspirationsUsed", "inspirationsToDrop"];

export const generateVisualPostTool: LlmToolDefinition = {
  name: GENERATE_VISUAL_POST_TOOL_NAME,
  description:
    "Returns a complete visual post (single image, carousel or short animation), preceded by its preparation and followed by its review. All text is written in English.",
  input_schema: {
    type: "object",
    properties: {
      ...PREP_FIELDS,
      concept: { type: "string", description: CONCEPT_FIELD_DESCRIPTION },
      ...HOOK_PREP_FIELDS,
      title: { type: "string", description: "The name of the idea, not of the subject: short, specific to this post, impossible to reuse for another." },
      hookVisual: {
        type: "string",
        description: "Description of the visual composition that grabs attention (single image, or 1st slide of a carousel).",
      },
      storyboard: {
        type: "array",
        description: "Breakdown into numbered slides if carousel (a single entry if single image).",
        items: {
          type: "object",
          properties: {
            planNumber: { type: "integer" },
            description: {
              type: "string",
              description: "The content of a slide: what is seen and the text displayed, in service of the concept's idea.",
            },
          },
          required: ["planNumber", "description"],
          additionalProperties: false,
        },
      },
      caption: { type: "string", description: "Develops the concept's idea with details from the material. A single call to action, at the end, if it serves the reader. Respect the length given by <platform>." },
      hashtags: {
        type: "array",
        description: "Each hashtag serves the post's discoverability, in the number given by <platform>. Never decorative.",
        items: { type: "string" },
      },
      usedExcerpts: {
        type: "array",
        description: "REQUIRED — never omit this field. Passages copied WORD FOR WORD from the supplied factual material that you used as the basis of this script, one per factual item reused. Return an empty array [] if no material was supplied or if you reused no passage word for word.",
        items: { type: "string" },
      },
      promisesMade: {
        type: "array",
        description: PROMISES_MADE_FIELD_DESCRIPTION,
        items: { type: "string" },
      },
      ...SELF_CHECK_FIELD,
    },
    required: [...PREP_REQUIRED, "title", "hookVisual", "storyboard", "caption", "hashtags", "usedExcerpts", "promisesMade", "selfCheck"],
    additionalProperties: false,
  },
};

export const generateTextPostTool: LlmToolDefinition = {
  name: GENERATE_TEXT_POST_TOOL_NAME,
  description: "Returns a text-only post, preceded by its preparation and followed by its review. All text is written in English.",
  input_schema: {
    type: "object",
    properties: {
      ...PREP_FIELDS,
      concept: { type: "string", description: CONCEPT_FIELD_DESCRIPTION },
      ...HOOK_PREP_FIELDS,
      title: { type: "string", description: "The name of the idea, not of the subject: short, specific to this post, impossible to reuse for another." },
      hookText: { type: "string", description: "The first sentence of the text: it creates a gap that forces the reader to read the second." },
      caption: { type: "string", description: "Develops the concept's idea with details from the material. A single call to action, at the end, if it serves the reader. Respect the length given by <platform>." },
      hashtags: {
        type: "array",
        description: "Each hashtag serves the post's discoverability, in the number given by <platform>. Never decorative. Empty if the platform doesn't use any.",
        items: { type: "string" },
      },
      usedExcerpts: {
        type: "array",
        description: "REQUIRED — never omit this field. Passages copied WORD FOR WORD from the supplied factual material that you used as the basis of this script, one per factual item reused. Return an empty array [] if no material was supplied or if you reused no passage word for word.",
        items: { type: "string" },
      },
      promisesMade: {
        type: "array",
        description: PROMISES_MADE_FIELD_DESCRIPTION,
        items: { type: "string" },
      },
      ...SELF_CHECK_FIELD,
    },
    required: [...PREP_REQUIRED, "title", "hookText", "caption", "hashtags", "usedExcerpts", "promisesMade", "selfCheck"],
    additionalProperties: false,
  },
};

export function toolForContentType(contentType: ContentType): LlmToolDefinition {
  if (contentType === "visual") return generateVisualPostTool;
  return generateTextPostTool;
}

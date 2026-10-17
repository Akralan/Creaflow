import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

/**
 * Reader portrait of a subject (docs/SPEC_PROMPT_GENERATION_V3.md §2.2, Annex A.5): 1 to 3
 * audiences, the main one first. A working hypothesis the author corrects; generation
 * injects it at the head of the message (<readers> block) and each post targets just one.
 */

export const MAX_READERS = 3;
const MAX_WORDS = 8;

export const readerSchema = z.object({
  label: z.string().trim().min(1).max(60),
  who: z.string().trim().min(1),
  knows: z.string().trim().default(""),
  wants: z.string().trim().default(""),
  stopsFor: z.string().trim().default(""),
  turnsOff: z.string().trim().default(""),
  words: z.array(z.string().trim().min(1)).max(MAX_WORDS).default([]),
});
export type Reader = z.infer<typeof readerSchema>;

export const readerPortraitSchema = z.object({
  readers: z.array(readerSchema).min(1).max(MAX_READERS),
  generatedAt: z.string().nullable().default(null),
  editedByUser: z.boolean().default(false),
  // The subject's "Who for" sentence at the time of the portrait: when it changes, the portrait
  // must be redone (unless it was corrected by hand).
  basedOnAudience: z.string().nullable().default(null),
});
export type ReaderPortrait = z.infer<typeof readerPortraitSchema>;

/** Tolerant read of a `products.readerPortrait` jsonb: null if absent or unreadable. */
export function parseStoredReaderPortrait(raw: unknown): ReaderPortrait | null {
  if (!raw || typeof raw !== "object") return null;
  const result = readerPortraitSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** A portrait must be (re)done if it is missing, or if the "Who for" sentence changed since — unless
 *  it was corrected by hand: only the "Redo the portrait" button then replaces it. */
export function portraitIsStale(product: { readerPortrait: unknown; targetAudience: string | null }): boolean {
  const portrait = parseStoredReaderPortrait(product.readerPortrait);
  if (!portrait) return true;
  if (portrait.editedByUser) return false;
  return (portrait.basedOnAudience ?? null) !== (product.targetAudience || null);
}

const TOOL_NAME = "describe_readers";

const describeReadersTool: LlmToolDefinition = {
  name: TOOL_NAME,
  description: "Describes the 1 to 3 audiences of a project. All text in English.",
  input_schema: {
    type: "object",
    properties: {
      readers: {
        type: "array",
        description: "1 to 3 audiences, the main one first.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short name of the audience, 2 to 4 words." },
            who: { type: "string", description: "Who exactly, in one concrete sentence." },
            knows: { type: "string", description: "What they already know about the field, their level." },
            wants: {
              type: "string",
              description:
                "What they come looking for by following this project, and what we'd like them to do (try, buy, follow, add to their wishlist…).",
            },
            stopsFor: { type: "string", description: "What stops them from scrolling." },
            turnsOff: { type: "string", description: "What makes them leave." },
            words: {
              type: "array",
              description: "3 to 8 words or expressions they really use.",
              items: { type: "string" },
            },
          },
          required: ["label", "who", "knows", "wants", "stopsFor", "turnsOff", "words"],
          additionalProperties: false,
        },
      },
    },
    required: ["readers"],
    additionalProperties: false,
  },
};

// Annex A.5.
const SYSTEM_PROMPT = `You draw up the portrait of a project's readers, so that the ghostwriter who will write about this project knows who they are talking to.

Rules:
- A project often has several audiences that don't expect the same thing: a game speaks to players and to other developers; a code tool to its users and to the technically curious; a craftsperson to their buyers and to people passionate about the trade. Give 1 to 3 audiences, only those this project really has an interest in speaking to. The first is the main one.
- If the author said who they build for, that is the reference: make it more precise, don't contradict it.
- Be concrete: "front-end developers maintaining a React app that is over two years old", not "developers".
- An audience's words are the ones it really uses among peers, not marketing's.
- It is a working hypothesis the author will correct. Invent no fact about the author or their project: you only describe what these readers know, look for and avoid.
- Write in English.`;

export interface ReaderPortraitContext {
  subjectName: string;
  subjectDescription: string | null;
  valueProposition: string | null;
  subjectAudience: string | null;
  brandAudience: string | null;
  activityType: string;
  platforms: string[];
  /** Summaries of the subject's documents (those already produced for the editor-in-chief). */
  materialSummaries: string[];
}

export const MAX_PORTRAIT_SUMMARIES = 15;

export function buildReaderPortraitMessage(ctx: ReaderPortraitContext): string {
  const lines = [
    `Subject: ${ctx.subjectName}${ctx.subjectDescription ? ` — ${ctx.subjectDescription}` : ""}`,
    ctx.valueProposition ? `Value proposition: ${ctx.valueProposition}` : null,
    `Who for, according to the author: ${ctx.subjectAudience || "(not specified)"}`,
    `The author's general audience: ${ctx.brandAudience || "(not specified)"}`,
    `What the author does: ${ctx.activityType || "(not specified)"}`,
    ctx.platforms.length > 0 ? `Platforms where they publish: ${ctx.platforms.join(", ")}` : null,
    ctx.materialSummaries.length > 0
      ? `What their material on this subject contains (summaries):\n${ctx.materialSummaries
          .slice(0, MAX_PORTRAIT_SUMMARIES)
          .map((s) => `- ${s}`)
          .join("\n")}`
      : "No summarized material yet on this subject.",
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export async function describeReaders(ctx: ReaderPortraitContext, now: Date = new Date()): Promise<ReaderPortrait> {
  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: buildReaderPortraitMessage(ctx),
    tool: describeReadersTool,
    maxTokens: 1500,
  });
  const parsed = z.object({ readers: z.array(readerSchema).min(1) }).parse(args);
  return {
    readers: parsed.readers.slice(0, MAX_READERS),
    generatedAt: now.toISOString(),
    editedByUser: false,
    basedOnAudience: ctx.subjectAudience || null,
  };
}

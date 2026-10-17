import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import type { Reader } from "./readerPortrait";

/**
 * A series' form for its reader (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4): thought out once,
 * with the timeline in view, written in black and white, correctable by the author. The writer
 * receives it as is for each post, in place of roles, angles and framings.
 */

export const seriesFormSchema = z.object({
  /** What this reader comes looking for in this series, in two sentences. */
  wants: z.string().trim().min(1),
  /** What a good episode is made of for them: a concrete structure, not adjectives. */
  episodeShape: z.string().trim().min(1),
  /** What makes them leave. */
  avoid: z.string().trim().min(1),
  /** The words they use. */
  words: z.array(z.string().trim().min(1)).max(12).default([]),
  /** The words they don't understand, to ban or to explain. */
  jargon: z.array(z.string().trim().min(1)).max(12).default([]),
  /** Length and register that suit them on the series' platform. */
  register: z.string().trim().min(1),
  /** What comes back in every episode (a sentence, a closing gesture, an opening) — empty if nothing. */
  signature: z.string().trim().default(""),
  generatedAt: z.string().nullable().default(null),
  editedByUser: z.boolean().default(false),
});
export type SeriesForm = z.infer<typeof seriesFormSchema>;

/** Tolerant read of a `content_series.form` jsonb: null if absent or unreadable. */
export function parseStoredSeriesForm(raw: unknown): SeriesForm | null {
  if (!raw || typeof raw !== "object") return null;
  const result = seriesFormSchema.safeParse(raw);
  return result.success ? result.data : null;
}

const TOOL_NAME = "describe_series_form";

const describeSeriesFormTool: LlmToolDefinition = {
  name: TOOL_NAME,
  description: "Writes the form of a series for its reader. All text in English.",
  input_schema: {
    type: "object",
    properties: {
      wants: { type: "string", description: "What this reader comes looking for in this series, in two concrete sentences." },
      episodeShape: {
        type: "string",
        description:
          "What a good episode is made of for them: the ingredients to find in it (what they want to know, what is useful to them, what makes them stay), with an example taken from the supplied events. Not a numbered recipe: two episodes of the same series must not have the same skeleton. Say nothing about how an episode ends or what it closes on. No adjectives, elements that can be verified in the post.",
      },
      avoid: { type: "string", description: "What makes them leave, in one or two precise sentences." },
      words: { type: "array", items: { type: "string" }, description: "6 to 12 words or expressions they really use." },
      jargon: { type: "array", items: { type: "string" }, description: "The project's words they don't understand (to avoid or to explain). Empty if they are from the trade." },
      register: { type: "string", description: "Length and register for them on the platform: number of lines, formal or informal address, first person, what not to do. Never name a language." },
      signature: { type: "string", description: "What can come back in each episode so the reader recognizes the series: a sentence, a way of opening or closing. Empty string if nothing stands out: a forced signature makes people leave. In English, even if an event it refers to is worded in another language: translate it." },
    },
    required: ["wants", "episodeShape", "avoid", "words", "jargon", "register", "signature"],
  },
};

export interface SeriesFormContext {
  brandName: string;
  activityType: string;
  subjectName: string;
  subjectDescription: string | null;
  reader: Reader;
  seriesLabel: string;
  seriesDescription: string;
  platforms: string[];
  /** Titles of real events from the timeline, to anchor the examples. */
  sampleEvents: string[];
}

function buildSystemPrompt(context: SeriesFormContext): string {
  return `You prepare a ghostwriter's work. ${context.brandName} (${context.activityType}) tells the story of ${context.subjectName} in a series of posts, "${context.seriesLabel}", written for ONE SINGLE reader. You write the form of this series for that reader: what they come looking for, what a good episode is made of for them, what makes them leave, their words, the length and the register.

A good episode is an event told: what happened, what it changed, for that particular person. The form says how it is told to THIS reader. Two fictional examples of what is expected, for two different readers of the same project (don't copy them, they show the level of precision):
- someone who uses what the author builds (a customer, a player, a patient…): "a precise situation lived by someone like them, what wasn't working, what the product showed or allowed, what that person did next, in six to ten lines, without a word of tech";
- a peer of the author (another developer, another craftsperson…): "what we believed, what broke, what we changed, the number before and after, in ten to fifteen lines, with the names of the tools".
The author writes alone and says "I"; never assume a team, unless their description mentions one. Write for the supplied reader, based on who they really are, and ground the example in one of the real events listed. Never describe the project itself: describe how it is told. The form says what an episode must contain and what it must avoid, never in what order: a writer following a numbered recipe would write the same post ten times. The form never says how an episode ends, nor what it closes on (a limit, a next step, a lesson): the writer chooses the ending from the event. It never names a language either: the language is set elsewhere. Write everything in English.`;
}

function buildUserMessage(context: SeriesFormContext): string {
  const r = context.reader;
  const lines = [
    `Series: ${context.seriesLabel} — ${context.seriesDescription}`,
    `Subject: ${context.subjectName}${context.subjectDescription ? ` — ${context.subjectDescription}` : ""}`,
    `Platforms: ${context.platforms.join(", ") || "not specified"}`,
    "",
    `Reader: ${r.label} — ${r.who}`,
    r.knows ? `Already knows: ${r.knows}` : null,
    r.wants ? `Comes looking for: ${r.wants}` : null,
    r.stopsFor ? `Stops for: ${r.stopsFor}` : null,
    r.turnsOff ? `Turned off by: ${r.turnsOff}` : null,
    r.words.length ? `Their words: ${r.words.join(", ")}` : null,
    "",
    context.sampleEvents.length
      ? `Real events from the subject's timeline (to anchor the structure example):\n${context.sampleEvents.map((t) => `- ${t}`).join("\n")}`
      : "No event recorded for now: describe the structure without an example drawn from the material.",
    "",
    `Write the series form via ${TOOL_NAME}.`,
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}

export async function describeSeriesForm(context: SeriesFormContext): Promise<SeriesForm> {
  const raw = await callStructured({
    system: buildSystemPrompt(context),
    userMessage: buildUserMessage(context),
    tool: describeSeriesFormTool,
    maxTokens: 1500,
  });
  const parsed = seriesFormSchema.omit({ generatedAt: true, editedByUser: true }).parse(raw);
  return { ...parsed, generatedAt: new Date().toISOString(), editedByUser: false };
}

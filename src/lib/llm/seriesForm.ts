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
  /** RETIRÉ du prompt : ce champ produisait des consignes de clôture (« Close with "Next: …" »)
   *  qui commandaient au rédacteur exactement ce que le cœur du prompt lui interdit. Gardé en
   *  lecture pour les formes déjà écrites, jamais redemandé au modèle. */
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
          "In ONE sentence: what this reader must feel or understand at the end of an episode, and why they would come back for the next one. Not a list of ingredients, not a structure, not a format — a writer handed a list fills it in section by section and every post looks the same. Say nothing about length, about code, about links, about how an episode opens or ends.",
      },
      avoid: { type: "string", description: "What makes them leave, in one or two precise sentences." },
      words: { type: "array", items: { type: "string" }, description: "6 to 12 words or expressions they really use." },
      jargon: { type: "array", items: { type: "string" }, description: "The project's words they don't understand (to avoid or to explain). Empty if they are from the trade." },
      register: { type: "string", description: "Length and register for them on the platform: number of lines, formal or informal address, first person, what not to do. Never name a language." },
    },
    required: ["wants", "episodeShape", "avoid", "words", "jargon", "register"],
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

Two fictional examples, for two different readers of the same project — they show what is expected, don't copy them:
- someone who uses what the author builds (a customer, a player, a patient…): "they must come away knowing that someone like them got out of a situation they recognise";
- a peer of the author (another developer, another craftsperson…): "they must come away with a decision they could have faced themselves, and what it really cost".
The author writes alone and says "I"; never assume a team, unless their description mentions one. Write for the supplied reader, based on who they really are, and ground the example in one of the real events listed. Never describe the project itself: describe how it is told. The form NEVER prescribes a shape: no order, no section, no length, no code, no link, no ending, no recurring sentence, nothing to include systematically. Whatever you write there, the writer will obey to the letter, in every post, forever — so write only what is true about this READER, never about the look of a post. It never names a language either: the language is set elsewhere. Write everything in English.`;
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

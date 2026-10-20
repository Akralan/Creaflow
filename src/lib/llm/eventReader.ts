import { z } from "zod";
import type { LlmToolDefinition } from "./types";

/**
 * The event reader (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3): an agent that reads ALL of a
 * subject's material, document by document and in full, and produces dated events from it. It
 * replaces the editor-in-chief, which only saw a one-sentence summary per document.
 *
 * This module only holds the prompt, the tools and the validation schemas; the orchestration
 * (database reads, saving, marking documents as read) lives in
 * src/lib/services/materialEventService.ts.
 */

export const EVENT_KINDS = ["failure", "decision", "result", "feedback", "milestone"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  failure: "Failure",
  decision: "Decision",
  result: "Result",
  feedback: "Feedback",
  milestone: "Milestone",
};

export const DATE_PRECISIONS = ["day", "month", "unknown"] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

/** Size of a document part returned by `read_document`. A 100 KB commit log makes nine parts:
 *  readable in full without ever saturating a turn. */
export const DOCUMENT_PART_CHARS = 12_000;

/** Maximum length of the copied passage that proves the event. */
export const MAX_EXCERPT_CHARS = 300;

export const LIST_DOCUMENTS_TOOL = "list_documents";
export const READ_DOCUMENT_TOOL = "read_document";
export const SAVE_EVENT_TOOL = "save_event";
export const COMPLETE_EVENT_TOOL = "complete_event";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** What the model sends to `save_event`, before normalization (empty date allowed). */
export const saveEventInputSchema = z.object({
  date: z.string().trim(),
  datePrecision: z.enum(DATE_PRECISIONS),
  title: z.string().trim().min(1).max(160),
  whatHappened: z.string().trim().min(1).max(1500),
  whatChanged: z.string().trim().max(1000),
  kind: z.enum(EVENT_KINDS),
  audienceAngles: z
    .array(z.object({ audience: z.string().trim().min(1), whatItChanges: z.string().trim().min(1).max(400) }))
    .max(5),
  sourceMaterialId: z.string().trim().min(1),
  excerpt: z.string().trim().min(1).max(MAX_EXCERPT_CHARS * 2),
});
export type SaveEventInput = z.infer<typeof saveEventInputSchema>;

/** Compléter un événement déjà enregistré : tout est facultatif sauf l'id. */
export const completeEventInputSchema = z.object({
  id: z.string().trim().min(1),
  date: z.string().trim().optional(),
  datePrecision: z.enum(DATE_PRECISIONS).optional(),
  whatChanged: z.string().trim().max(1000).optional(),
  excerpt: z.string().trim().min(1).max(MAX_EXCERPT_CHARS * 2).optional(),
  audienceAngles: z
    .array(z.object({ audience: z.string().trim().min(1), whatItChanges: z.string().trim().min(1).max(400) }))
    .max(5)
    .optional(),
});
export type CompleteEventInput = z.infer<typeof completeEventInputSchema>;

export interface NormalizedEventDate {
  date: string | null;
  datePrecision: DatePrecision;
}

/**
 * A date of `day` or `month` precision must be a valid ISO day; at month precision, the day is
 * brought back to the 1st. `unknown` clears the date. An impossible date is an error returned to
 * the model, which corrects its call.
 */
export function normalizeEventDate(date: string, precision: DatePrecision): NormalizedEventDate {
  if (precision === "unknown") return { date: null, datePrecision: "unknown" };
  if (!ISO_DAY.test(date)) {
    throw new Error(`Invalid date "${date}": expected YYYY-MM-DD, or datePrecision "unknown" if the text doesn't give it.`);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Date "${date}" is impossible in the calendar.`);
  }
  return { date: precision === "month" ? `${date.slice(0, 7)}-01` : date, datePrecision: precision };
}

/** Whitespace, line breaks and apostrophes normalized: the model copies "as is" up to
 *  punctuation, not to the exact character. */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[’‘`´]/g, "'")
    // Quotation marks disappear on both sides: « x » and "x" must match, spaces included.
    .replace(/["“”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** The passage must be found in the document: it is the proof that the event isn't made up. */
export function excerptIsInDocument(excerpt: string, documentText: string): boolean {
  const needle = normalizeForMatch(excerpt);
  return needle.length > 0 && normalizeForMatch(documentText).includes(needle);
}

export function splitDocumentIntoParts(text: string, partChars = DOCUMENT_PART_CHARS): string[] {
  if (text.length <= partChars) return [text];
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(cursor + partChars, text.length);
    // Cut at a line end when possible: a log entry must not be sliced in two mid-sentence.
    if (end < text.length) {
      const newline = text.lastIndexOf("\n", end);
      if (newline > cursor + partChars / 2) end = newline + 1;
    }
    parts.push(text.slice(cursor, end));
    cursor = end;
  }
  return parts;
}

export function buildEventReaderTools(params: { audienceLabels: string[] }): LlmToolDefinition[] {
  // Le public est borné par le schéma quand le portrait existe : le code ne fait pas confiance au
  // modèle sur une étiquette (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §3).
  const audienceAnglesProperty = {
    type: "array",
    description:
      "One entry per audience this fact speaks to: what it changes FOR THEM, in THEIR words. Empty array when it changes nothing for anyone — a normal answer, not a failure.",
    items: {
      type: "object",
      properties: {
        audience: params.audienceLabels.length > 0 ? { type: "string", enum: params.audienceLabels } : { type: "string" },
        whatItChanges: {
          type: "string",
          description: "One sentence, in this audience's words, of the consequence for them. Not the mechanism, not a rewording of the title.",
        },
      },
      required: ["audience", "whatItChanges"],
    },
  };

  return [
    {
      name: LIST_DOCUMENTS_TOOL,
      description: "The subject's documents that remain to be read, with their number of parts.",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    {
      name: READ_DOCUMENT_TOOL,
      description: "The full text of one part of a document. Read all the parts of a document, in order.",
      input_schema: {
        type: "object",
        properties: {
          documentId: { type: "string", description: "Id of the document, as list_documents gives it." },
          part: { type: "integer", description: "Number of the part, starting at 1." },
        },
        required: ["documentId", "part"],
      },
    },
    {
      name: SAVE_EVENT_TOOL,
      description:
        "Saves ONE event found in the document being read. Call it as soon as you meet the event, before reading on.",
      input_schema: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD. To the month: YYYY-MM-01. Empty string if the precision is unknown." },
          datePrecision: { type: "string", enum: [...DATE_PRECISIONS], description: "day: the text gives the day. month: the month only. unknown: no date in the text." },
          title: { type: "string", description: "The moment, not a theme. \"The tester drops the controller after 40 seconds\", never \"The test\". Written in English." },
          whatHappened: { type: "string", description: "2 to 5 sentences: the facts, with the numbers and names as they are in the text. Nothing else. Written in English." },
          whatChanged: { type: "string", description: "What it changed afterwards according to the text (a decision, an abandonment, a number that moves). Empty string if the text doesn't say. Written in English." },
          kind: { type: "string", enum: [...EVENT_KINDS], description: "failure: something broke or failed. decision: a choice made. result: a measurement, a number. feedback: what a person said or did. milestone: a step crossed, a first time." },
          audienceAngles: audienceAnglesProperty,
          sourceMaterialId: { type: "string", description: "Id of the document where the event is found." },
          excerpt: { type: "string", description: `The exact passage from the document that proves the event, copied as is (in its original language), ${MAX_EXCERPT_CHARS} characters at most.` },
        },
        required: ["date", "datePrecision", "title", "whatHappened", "whatChanged", "kind", "audienceAngles", "sourceMaterialId", "excerpt"],
      },
    },
    {
      name: COMPLETE_EVENT_TOOL,
      description:
        "Completes an event you already saved, when the document you are reading now tells it better. Only send the fields you are improving.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Id of the event to complete, as the already-saved list gives it." },
          date: { type: "string", description: "YYYY-MM-DD, if this document dates a fact that had no date." },
          datePrecision: { type: "string", enum: [...DATE_PRECISIONS], description: "Precision of the date you are adding." },
          whatChanged: { type: "string", description: "The follow-up this document gives, if the first one did not." },
          excerpt: { type: "string", description: "A passage that proves it better, copied as is from this document." },
          audienceAngles: audienceAnglesProperty,
        },
        required: ["id"],
      },
    },
  ];
}

export interface EventReaderPromptContext {
  brandName: string;
  subjectName: string;
  subjectDescription: string | null;
  audiences: Array<{ label: string; who: string; wants: string; stopsFor: string; turnsOff: string; words: string[] }>;
  unreadDocuments: number;
  alreadyReadDocuments: number;
  /** Avec leur id : c'est ce qui permet de compléter plutôt que de sauter un doublon. */
  existingEvents: Array<{ id: string; date: string | null; title: string }>;
}

export function buildEventReaderSystemPrompt(context: EventReaderPromptContext): string {
  return `You are the material reader for ${context.brandName}, on the subject "${context.subjectName}". You read everything that was uploaded and extract the events from it: what happened, when, and what it changed. You never write a post: others will use your events to tell the story.

An event is a fact that CHANGES SOMETHING FOR SOMEONE. Before saving anything, the question is always the same: does this fact change something for someone in the audiences below? If it changes nothing for anyone, it is not an event, however true it may be.

It is a precise moment, not a theme and not a feature: "The first tester drops the controller after 40 seconds because the jump feels mushy", never "The test" nor "The jump mechanic". (Fictional example: never reuse it.)

A technical document can perfectly well contain events, and some of the best ones. What matters is not where the fact comes from, it is whether it changes something for someone. "Nothing the camera films ever leaves the phone, the server only receives degrees" comes from a privacy document and it changes everything for someone who worries about their patients. "The angle series are stored in a JSONB column" comes from the same kind of document and changes nothing for anyone: it is not an event.

For each audience the fact speaks to, you write ONE line: what it changes FOR THEM, in THEIR words. The same fact becomes "the counter follows the patient with no lag" for one and "200 ms response time" for another. That line is what the writer will start from, so it is never a translation of the title: it says the consequence, not the mechanism. No audience it speaks to: empty list, and that is a normal answer.

All the text you write (titles, descriptions) is in English, even if the documents are in another language. Only the excerpt stays in the document's own words.

<method>
1. Call ${LIST_DOCUMENTS_TOOL}.
2. Read every document that remains to be read, in full, part by part and in order, with ${READ_DOCUMENT_TOOL}. Skip no part.
3. As soon as you meet an event, save it with ${SAVE_EVENT_TOOL}, before reading on. Several events in the same part: several calls.
4. When everything is read, answer in one or two sentences what you read and how many events you saved.
</method>

<rules>
- The facts come from the text, and only from the text. Numbers, names, dates: as is. Nothing is deduced, nothing is rounded, nothing is added.
- The date is the one the text gives. A dated log: the date of the entry (precision day). A text that says "in March": the month (precision month). Technical docs without a date: unknown, even if you have a hunch. "Last updated: October 2026" dates the document, not what it reports: a fact taken from such a doc is unknown, unless the text gives it its own date.
- In a log, every dated entry that reports something is an event: don't skip one because it looks small. The very first moment of a project (the conversation or realization that triggered it, the first prototype) is an event, and often the most important.
- The same document can yield several events on the same date if it tells several things that day (a decision and a failure, for example).
- A document that describes how the system works yields an event every time one of its facts changes something for one of the audiences — a guarantee, a constraint they will feel, a number that settles a doubt, a choice made and what it gave up. With precision unknown if nothing dates it. What it does not yield: plumbing nobody feels.
- A commit log: not one event per commit. Group them, and keep what tells something: a decision, a failure, a number, an abandonment, a first time. A plain "add page X" is not an event.
- An event already saved (list below) is told better by the document you are reading now? ${COMPLETE_EVENT_TOOL} it: add the date it was missing, what it changed, a closer excerpt, one more audience. Don't save it twice, and don't skip the better version either — the most precise framing wins, not the first one read.
- whatChanged gives the follow-up that the text gives ("a week later, the 45° camera is mandatory"). If the text says nothing, empty string: don't guess.
- excerpt is copied as is from the document, ${MAX_EXCERPT_CHARS} characters at most. It is the proof. A passage that can't be found gets the event refused: copy again shorter and more exactly.
- audienceAngles: only audiences from the list below, and for each one the line of what this fact changes for them, in their words. Empty when the fact changes nothing for anyone.
</rules>`;
}

export function buildEventReaderUserMessage(context: EventReaderPromptContext): string {
  const lines: string[] = [];
  lines.push(`Subject: ${context.subjectName}${context.subjectDescription ? ` — ${context.subjectDescription}` : ""}`);
  if (context.audiences.length > 0) {
    // Le portrait COMPLET, pas l'étiquette : c'est avec ça que se décide « est-ce que ce fait change
    // quelque chose pour lui », et c'est dans ses mots que s'écrit la ligne qui lui est destinée.
    lines.push("Subject audiences — for each one, you may write a line of what a fact changes for them:");
    for (const a of context.audiences) {
      lines.push(
        [
          `- ${a.label}: ${a.who}`,
          a.wants ? `  Comes looking for: ${a.wants}` : null,
          a.stopsFor ? `  Stops for: ${a.stopsFor}` : null,
          a.turnsOff ? `  Turned off by: ${a.turnsOff}` : null,
          a.words.length ? `  Their words: ${a.words.join(", ")}` : null,
        ]
          .filter((l): l is string => l !== null)
          .join("\n")
      );
    }
  } else {
    lines.push("Subject audiences: none defined for now (leave audienceAngles empty).");
  }
  lines.push(
    `Documents to read: ${context.unreadDocuments}.${context.alreadyReadDocuments > 0 ? ` Already read in a previous pass: ${context.alreadyReadDocuments}, don't read them again.` : ""}`
  );
  if (context.existingEvents.length > 0) {
    lines.push(`Events already saved (${context.existingEvents.length}), not to be redone:`);
    for (const e of context.existingEvents) lines.push(`- [${e.id}] ${e.date ?? "unknown date"}: ${e.title}`);
  } else {
    lines.push("No event saved for now.");
  }
  lines.push("", `Start with ${LIST_DOCUMENTS_TOOL}.`);
  return lines.join("\n");
}

// --- Audience qualification (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3) ---
// Events read before the reader portrait existed have no audience; when the portrait is born or
// changes, they are given one in a structured call per batch, without re-reading the documents.

export const QUALIFY_EVENTS_TOOL = "qualify_events";

export const qualifiedEventsSchema = z.object({
  events: z.array(z.object({ id: z.string().min(1), audiences: z.array(z.string().trim().min(1)).max(5) })),
});

export function buildQualifyEventsTool(audienceLabels: string[]): LlmToolDefinition {
  return {
    name: QUALIFY_EVENTS_TOOL,
    description: "Says, for each event, which of the subject's audiences it can interest.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          description: "One element per event supplied, in the same order, with its id as is.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              audiences: {
                type: "array",
                items: { type: "string", enum: audienceLabels },
                description: "The audiences for whom this event is worth a post. Empty if none: it will remain visible to all series.",
              },
            },
            required: ["id", "audiences"],
          },
        },
      },
      required: ["events"],
    },
  };
}

export function buildQualifyEventsPrompt(params: {
  subjectName: string;
  readers: Array<{ label: string; who: string; wants: string; stopsFor: string; turnsOff: string }>;
  events: Array<{ id: string; date: string | null; title: string; whatHappened: string; kind: string }>;
}): { system: string; userMessage: string } {
  const system = `You sort the events on the timeline of "${params.subjectName}" by audience. For each event, say which of the subject's audiences it can make a post that stops them: an audience is kept if the event teaches them something they come looking for, not if it might vaguely concern them. An event can target several audiences, or none. Don't modify the events, don't skip any id.`;
  const readers = params.readers
    .map((r) => `- ${r.label}: ${r.who}${r.wants ? ` Comes looking for: ${r.wants}` : ""}${r.stopsFor ? ` Stops for: ${r.stopsFor}` : ""}${r.turnsOff ? ` Turned off by: ${r.turnsOff}` : ""}`)
    .join("\n");
  const events = params.events.map((e) => `- [${e.id}] ${e.date ?? "undated"} · ${e.kind} · ${e.title} — ${e.whatHappened}`).join("\n");
  return { system, userMessage: `Subject audiences:\n${readers}\n\nEvents:\n${events}\n\nAnswer via ${QUALIFY_EVENTS_TOOL}.` };
}

/** Turn cap for a read: each part needs at least one turn, and the saves add up (often grouped in
 *  the same turn). Bounded so that a read never runs endlessly. */
/** Un titre daté : `## 2025-11-09`, `# 2025-11-09 — …`, ou une ligne qui commence par la date. */
const DATED_HEADING = /^\s*(?:#{1,6}\s*|[-*]\s*)?(\d{4}-\d{2}-\d{2})\b/gm;

/**
 * Combien de jours distincts ce texte raconte. C'est ce qui sépare un journal d'une page de
 * documentation (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §5) : sur le pack MyKiné, le devlog en compte
 * onze et les treize fichiers techniques zéro.
 */
export function datedEntryCount(text: string): number {
  const days = new Set<string>();
  for (const match of text.matchAll(DATED_HEADING)) days.add(match[1]);
  return days.size;
}

/**
 * Les documents à lire, ceux qui racontent d'abord : le récit est lu quand le budget de tours est
 * intact. Tri stable, pour que deux lectures de la même matière donnent le même ordre.
 */
export function narrativeFirst<T extends { rawText: string }>(documents: T[]): T[] {
  return documents
    .map((doc, index) => ({ doc, index, dates: datedEntryCount(doc.rawText) }))
    .sort((a, b) => b.dates - a.dates || a.index - b.index)
    .map((d) => d.doc);
}

/**
 * Le budget de tours de la lecture. L'ancienne version ne comptait que les parties lues — or chaque
 * enregistrement coûte un tour, et un journal de onze entrées tient dans une seule partie. C'est ce
 * qui a coupé la lecture du pack MyKiné au 33e tour sur un plafond de 32.
 */
export function maxTurnsForReading(input: { parts: number; expectedEvents: number }): number {
  return Math.min(240, 12 + input.parts * 4 + input.expectedEvents * 2);
}

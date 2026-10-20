import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import type { Reader } from "./readerPortrait";
import { logger } from "@/lib/logger";

/**
 * Prompt 29 — le relecteur, et il n'est PAS celui qui écrit.
 *
 * Jusqu'ici, la relecture (`review_draft`) était un outil que le rédacteur s'appelait à lui-même,
 * deux tours après avoir écrit le texte : il se notait avec, dans son contexte, la matière, ses
 * événements et son propre raisonnement. Il savait donc toujours ce qu'il avait voulu dire. Sur un
 * post qui citait `repCounter.ts` et `DELETE /patients/{id}` à un kiné, son verdict a été
 * « no technical jargon, matches the reader » (constaté en réel le 2026-10-20).
 *
 * Celui-ci ne voit QUE le portrait du lecteur et le texte du post. Ni la matière, ni les
 * événements, ni le raisonnement — c'est tout l'intérêt : il ne peut pas deviner ce que ça voulait
 * dire, donc il bute exactement là où le lecteur butera.
 *
 * Aucune liste de mots interdits n'est codée en dur, et c'est volontaire : ce qui est de la
 * plomberie pour un kiné est du quotidien pour un développeur. C'est le portrait qui tranche.
 */

export interface UnknownTerm {
  term: string;
  /** Le post dit-il, dans la même phrase, ce que ça change pour ce lecteur ? */
  explained: boolean;
}

export interface ReaderReview {
  unknownToReader: UnknownTerm[];
  /** Ce lecteur pourrait-il répéter ce post à un confrère avec ses mots à lui ? */
  couldRepeat: boolean;
  why: string;
}

/** Au-delà, le rapport renvoyé au modèle devient illisible et il corrige moins bien. */
const MAX_REPORTED = 5;

const SYSTEM = `You are handed a post and a description of the ONE person it is written for. You have not seen the material it came from, and that is the point: you know exactly what this reader knows, and nothing more. Judge only what is on the page.

Go sentence by sentence and list every word, name or reference you cannot understand from the reader's description alone — a technical term, a tool or vendor name, a file, an address, a measurement unit they would not use, an internal name. For each one, say whether the post states, in the same sentence, what it changes FOR THIS READER. "Stored as JSONB" is not explained; "stored as JSONB, so a whole movement fits in one line" is.

An empty list means you went through every sentence and found none. It does not mean you did not look.

Then answer one question: could this reader repeat what this post says to a colleague, using only words they already had? If not, say in one line what stops them.

You never rewrite the post and you never suggest wording. You report.`;

const TOOL: LlmToolDefinition = {
  name: "report_reading",
  description: "Reports what this reader does not understand in this post, and whether they could repeat it.",
  input_schema: {
    type: "object",
    properties: {
      unknownToReader: {
        type: "array",
        description: "One entry per word, name or reference this reader could not understand from their own description. Empty when you found none.",
        items: {
          type: "object",
          properties: {
            term: { type: "string", description: "The word or reference, copied exactly as it appears in the post." },
            explained: { type: "boolean", description: "True only if the same sentence says what it changes for this reader." },
          },
          required: ["term", "explained"],
        },
      },
      couldRepeat: { type: "boolean", description: "True if this reader could repeat what the post says to a colleague, using only words they already had." },
      why: { type: "string", description: "If couldRepeat is false: what stops them, in one line. Empty otherwise." },
    },
    required: ["unknownToReader", "couldRepeat", "why"],
  },
};

const answerSchema = z.object({
  unknownToReader: z
    .array(z.object({ term: z.string().trim().min(1), explained: z.boolean() }))
    .catch([]),
  couldRepeat: z.boolean().catch(true),
  why: z.string().trim().catch(""),
});

export function buildReaderReviewMessage(input: { reader: Reader; postText: string }): string {
  const r = input.reader;
  const who = [
    `The reader: ${r.label} — ${r.who}`,
    r.knows ? `Already knows: ${r.knows}` : null,
    r.wants ? `Comes looking for: ${r.wants}` : null,
    r.stopsFor ? `Stops for: ${r.stopsFor}` : null,
    r.turnsOff ? `Turned off by: ${r.turnsOff}` : null,
    r.words.length ? `Their words: ${r.words.join(", ")}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  return `${who}\n\n<the_post>\n${input.postText}\n</the_post>\n\nAnswer via ${TOOL.name}.`;
}

/**
 * Les fautes à renvoyer au rédacteur. Fonction PURE : c'est elle qui décide ce qui bloque, pas le
 * relecteur — lui ne fait que constater.
 */
export function reviewFailures(review: ReaderReview): string[] {
  const failures = review.unknownToReader
    .filter((t) => !t.explained)
    .slice(0, MAX_REPORTED)
    .map((t) => `A reader of this post does not understand "${t.term}" and the post never says what it changes for them: say what it changes, or take it out.`);
  if (failures.length > 0) return failures;
  if (!review.couldRepeat) {
    return [`This reader could not repeat what this post says using only words they already had: ${review.why || "it stays on your side of the work."}`];
  }
  return [];
}

/** Jamais bloquant : une panne du relecteur ne doit pas empêcher d'écrire un post. */
export async function reviewForReader(input: { reader: Reader; postText: string }): Promise<ReaderReview> {
  try {
    const raw = await callStructured({
      system: SYSTEM,
      userMessage: buildReaderReviewMessage(input),
      tool: TOOL,
      maxTokens: 1024,
    });
    return answerSchema.parse(raw);
  } catch (error) {
    logger.warn("Reader review failed", { error: String(error) });
    return { unknownToReader: [], couldRepeat: true, why: "" };
  }
}

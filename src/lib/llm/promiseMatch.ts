import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { logger } from "@/lib/logger";

/**
 * Prompt 28a — does an event let the author keep a promise? (docs/SPEC_FIL_NARRATIF.md §8)
 *
 * One call, no tool access, one answer: the id of an event, or none. Deliberately PERMISSIVE: the
 * promises actually captured are soft ("in a coming episode I'll show how…"), so the question is
 * whether the event lets the author say what they announced — not whether it fulfils a contract. A
 * strict reading would never match anything and the whole post type would never appear.
 *
 * Never blocking: a failure here means no pairing, which means one fewer story post.
 */

export interface PromiseCandidate {
  id: string;
  date: string | null;
  title: string;
  whatHappened: string;
}

const SYSTEM = `You are given a promise an author made to their audience in a published post, and a list of things that happened afterwards.

Your job: find the ONE event that lets the author say what they announced. Not the event that fulfils a contract to the letter — most promises are loose ("in a coming episode I'll show how…"), and the right event is the one that gives the author something real to show about what they announced.

Rules:
- Pick at most one event, by id. If none of them lets the author say what they announced, return null. Returning null is a normal answer, not a failure.
- Judge on what happened, not on the words. An event that shares vocabulary with the promise but is about something else is not a match.
- Never invent an id: it must be one of the ids given to you.`;

const TOOL: LlmToolDefinition = {
  name: "match_promise",
  description: "Names the event that lets the author say what they announced, or none.",
  input_schema: {
    type: "object",
    properties: {
      eventId: {
        type: ["string", "null"],
        description: "The id of the event that lets the author say what they announced, taken from the list. null if none of them does.",
      },
    },
    required: ["eventId"],
  },
};

const answerSchema = z.object({ eventId: z.string().nullable().catch(null) });

function buildUserMessage(promise: string, postText: string, candidates: PromiseCandidate[]): string {
  const events = candidates.map((c) => `- id: ${c.id} | ${c.date ?? "undated"} | ${c.title}\n  ${c.whatHappened}`).join("\n");
  return `<promise>\n${promise}\n</promise>\n\n<the_post_that_made_it>\n${postText}\n</the_post_that_made_it>\n\n<events_since>\n${events}\n</events_since>`;
}

export async function matchPromiseToEvent(input: { promise: string; postText: string; candidates: PromiseCandidate[] }): Promise<string | null> {
  if (input.candidates.length === 0) return null;
  try {
    const raw = await callStructured({
      system: SYSTEM,
      userMessage: buildUserMessage(input.promise, input.postText, input.candidates),
      tool: TOOL,
      maxTokens: 256,
    });
    const { eventId } = answerSchema.parse(raw);
    // The model is not trusted with the id: an unknown one is no match, never a crash downstream.
    return eventId && input.candidates.some((c) => c.id === eventId) ? eventId : null;
  } catch (error) {
    logger.warn("Promise pairing failed", { error: String(error) });
    return null;
  }
}

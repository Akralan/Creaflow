import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { logger } from "@/lib/logger";

/**
 * Prompt 24 — la synthèse de la ligne de temps (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §5).
 *
 * Le lecteur d'événements lit document par document et enregistre au fil de l'eau : il ne peut pas
 * voir qu'un fait et sa raison vivent dans deux fichiers, ni qu'il a enregistré deux fois la même
 * chose sous deux angles. Cette passe regarde la ligne de temps ENTIÈRE, une fois tout lu, et ne
 * peut faire que trois choses : fusionner, compléter, retirer. **Jamais créer** — tout ce qu'elle
 * propose doit déjà exister, prouvé par un extrait, sinon on réinventerait le rédacteur en chef.
 *
 * Ce numéro était celui de la « qualification des événements par public », supprimée : trier après
 * coup sans le document sous les yeux ne permettait pas d'écrire ce qu'un fait change pour qui.
 */

export interface TimelineFix {
  action: "merge" | "complete" | "drop";
  eventId: string;
  /** merge : l'événement qui absorbe celui-ci. */
  intoEventId?: string;
  /** complete : le « ce que ça a changé » trouvé ailleurs dans la ligne de temps. */
  whatChanged?: string;
}

export interface SynthesisEvent {
  id: string;
  date: string | null;
  title: string;
  whatHappened: string;
  whatChanged: string | null;
  audiences: string[];
}

const SYSTEM = `You are given the complete timeline of a subject, built document by document by a reader that could not see the whole at once. Your job is to clean it up, and nothing else.

You can do three things, and only three:
- merge: two entries tell the SAME fact. Keep the one that is better framed — dated rather than undated, with a consequence rather than without — and merge the other into it.
- complete: an entry has no consequence, and another entry in the timeline IS its consequence ("a week later, the 45° camera became mandatory"). Fill it in with what the timeline already says.
- drop: an entry changes nothing for any of the audiences. A piece of plumbing nobody feels, a restatement of how the system is built.

You never create an entry, and you never invent a fact. If an entry looks fine, say nothing about it. Returning no fix at all is a perfectly good answer.`;

const TOOL: LlmToolDefinition = {
  name: "fix_timeline",
  description: "Lists the corrections to apply to the timeline. Empty when it needs none.",
  input_schema: {
    type: "object",
    properties: {
      fixes: {
        type: "array",
        description: "One entry per correction. Empty if the timeline is fine as it is.",
        items: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["merge", "complete", "drop"], description: "merge: same fact told twice. complete: fill in its consequence. drop: changes nothing for anyone." },
            eventId: { type: "string", description: "The id of the entry this fix applies to." },
            intoEventId: { type: "string", description: "merge only: the id of the entry that absorbs it." },
            whatChanged: { type: "string", description: "complete only: the consequence, taken from another entry of this timeline." },
          },
          required: ["action", "eventId"],
        },
      },
    },
    required: ["fixes"],
  },
};

const answerSchema = z.object({
  fixes: z
    .array(
      z.object({
        action: z.enum(["merge", "complete", "drop"]),
        eventId: z.string().trim().min(1),
        intoEventId: z.string().trim().min(1).optional(),
        whatChanged: z.string().trim().min(1).optional(),
      })
    )
    .catch([]),
});

/**
 * Ce que le code accepte d'appliquer. Un événement **déjà raconté par un post** ne se retire ni ne
 * se fusionne : un script pointe dessus, et le post existe déjà chez le lecteur.
 */
export function applicableFixes(fixes: TimelineFix[], knownIds: string[], toldEventIds: string[]): TimelineFix[] {
  const known = new Set(knownIds);
  const told = new Set(toldEventIds);
  return fixes.filter((fix) => {
    if (!known.has(fix.eventId)) return false;
    if (fix.action === "drop") return !told.has(fix.eventId);
    if (fix.action === "merge") return Boolean(fix.intoEventId) && known.has(fix.intoEventId as string) && !told.has(fix.eventId);
    return Boolean(fix.whatChanged);
  });
}

export async function synthesiseTimeline(input: { subjectName: string; events: SynthesisEvent[] }): Promise<TimelineFix[]> {
  if (input.events.length === 0) return [];
  const lines = input.events
    .map((e) => `- [${e.id}] ${e.date ?? "undated"} · ${e.title} — ${e.whatHappened}${e.whatChanged ? ` (changed: ${e.whatChanged})` : " (no consequence recorded)"} · audiences: ${e.audiences.join(", ") || "none"}`)
    .join("\n");
  try {
    const raw = await callStructured({
      system: SYSTEM,
      userMessage: `Subject: ${input.subjectName}\n\nTimeline:\n${lines}\n\nAnswer via ${TOOL.name}.`,
      tool: TOOL,
      maxTokens: 2048,
    });
    return answerSchema.parse(raw).fixes;
  } catch (error) {
    logger.warn("Timeline synthesis failed", { error: String(error) });
    return [];
  }
}

import { z } from "zod";
import { callStructured } from "./provider";
import type { LlmToolDefinition } from "./types";

/**
 * Le vérificateur des sources d'un post (décidé le 2026-10-26). Le rédacteur lit large autour de son
 * adresse et peut raconter l'entrée voisine en déclarant la sienne : au test « Tellovo sur Tellovo »,
 * un post déclaré sur le mot de passe racontait la veille d'inspiration, et la veille est revenue trois
 * fois dans la semaine. Un second appel lit le post et dit quels faits il raconte vraiment ; ce sont
 * eux qui sont marqués comme racontés. Il ne voit pas la déclaration du rédacteur, pour juger le texte seul.
 */

export interface VerifiableFact {
  id: string;
  address: string;
  text: string;
}

/** Longueur gardée de chaque ligne : assez pour reconnaître le fait. */
export const FACT_TEXT_CHARS = 160;

const TOOL: LlmToolDefinition = {
  name: "record_sources",
  description: "Records the ids of the facts the post tells.",
  input_schema: {
    type: "object",
    properties: {
      event_ids: { type: "array", description: "The ids of the facts the post's story is built on.", items: { type: "string" } },
    },
    required: ["event_ids"],
    additionalProperties: false,
  },
};

export const VERIFIER_SYSTEM_PROMPT =
  "You check which facts a post tells. You get the post, and a list of facts from the author's material, each with its id, its address and the text of its line. Return the ids of the facts the post's story is built on — not the ones it only mentions in passing. Nothing else.";

export function buildVerifierMessage(post: string, facts: VerifiableFact[]): string {
  const rows = facts.map((f) => `[${f.id}] ${f.address} · ${f.text.trim().slice(0, FACT_TEXT_CHARS)}`);
  return `<post>\n${post.trim()}\n</post>\n\n<facts>\n${rows.join("\n")}\n</facts>`;
}

const resultSchema = z.object({ event_ids: z.array(z.string()) });

/** Les ids que le post raconte, limités à ceux de la liste. Vide si le modèle n'en reconnaît aucun. */
export async function verifyPostSources(post: string, facts: VerifiableFact[]): Promise<string[]> {
  if (facts.length === 0) return [];
  const args = await callStructured({ system: VERIFIER_SYSTEM_PROMPT, userMessage: buildVerifierMessage(post, facts), tool: TOOL, maxTokens: 400 });
  const known = new Set(facts.map((f) => f.id));
  return [...new Set(resultSchema.parse(args).event_ids.filter((id) => known.has(id)))];
}

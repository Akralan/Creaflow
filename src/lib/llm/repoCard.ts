import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { DEFAULT_PHASE, PHASES } from "@/lib/phases";

/**
 * The card of the /start flow (docs/SPEC_ENTREE_PAR_LE_REPO.md §4): from one public repository,
 * the product's name and the three fields the person only has to check — what is built, who it is
 * for, the problem it solves. One call, no tool access; a failure is never blocking (the fields
 * stay empty and the person fills them in).
 */
export interface RepoCardInput {
  fullName: string;
  repoDescription: string | null;
  language: string | null;
  /** README, docs and recent commit log, already cut to size. */
  excerpt: string;
}

export const repoCardSchema = z.object({
  name: z.string().default(""),
  tagline: z.string().default(""),
  building: z.string().default(""),
  who: z.string().default(""),
  problem: z.string().default(""),
  // Où en est le projet (src/lib/phases.ts), deviné ici et présélectionné sur la carte : l'auteur
  // corrige d'un clic. Une valeur inconnue retombe sur la phase par défaut plutôt que de faire échouer la carte.
  phase: z.enum(PHASES).catch(DEFAULT_PHASE).default(DEFAULT_PHASE),
  phaseReason: z.string().default(""),
});

export type RepoCard = z.infer<typeof repoCardSchema>;

const TOOL: LlmToolDefinition = {
  name: "describe_product",
  description: "Describes the product built in a repository for its author to check. All text in English.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "The product's name as its README calls it (not the raw repository slug if the README gives a nicer one)." },
      tagline: { type: "string", description: "What the product is, in one short line (max 12 words)." },
      building: { type: "string", description: "What is being built, in one sentence, in the third person (\"A tool to…\"). Only what the material shows." },
      who: { type: "string", description: "Who it is for, in one sentence: the concrete people it serves. Empty if the material doesn't allow saying." },
      problem: { type: "string", description: "The problem it solves for them, in one sentence, as they would feel it. Empty if the material doesn't allow saying." },
      phase: {
        type: "string",
        enum: [...PHASES],
        description:
          "Where the project stands. engage: an idea or a first prototype being announced, little code, nothing usable yet. build: the product is being built, features keep landing, no sign of outside users. beta: a few people are let in — waitlist, beta, early access, invitations. launch: it is opening to everyone right now — public sign-up, pricing, launch announcement. grow: it has been out for a while — tagged releases, a public changelog, user feedback, issues from users, usage numbers.",
      },
      phaseReason: { type: "string", description: "Why, in one short line (max 12 words), naming the signals seen in the material." },
    },
    required: ["name", "tagline", "building", "who", "problem", "phase", "phaseReason"],
  },
};

const SYSTEM_PROMPT = `You read the public repository of a software product (README, docs, recent commits) to understand its business, so its author can start publishing about it.

Rules:
- Invent nothing: describe only what the material shows. A simple, accurate sentence beats a brilliant, false one. If a field can't be established, return an empty string.
- Write in English, plain words, no marketing jargon.
- Be concrete: "backend developers maintaining webhook integrations", not "developers".
- "Who it's for" is the buyer or user of the product, not the person who writes the code.
- The problem is the pain the product removes, not a feature list.
- For the phase, trust the recent commits and the journal over old planning documents. Code that is deployed but used by nobody outside is still "build".`;

export function buildRepoCardMessage(input: RepoCardInput): string {
  return [
    `Repository: ${input.fullName}`,
    input.repoDescription ? `GitHub description: ${input.repoDescription}` : null,
    input.language ? `Main language: ${input.language}` : null,
    "",
    "=== MATERIAL ===",
    input.excerpt || "(empty)",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export async function describeRepoCard(input: RepoCardInput): Promise<RepoCard> {
  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: buildRepoCardMessage(input),
    tool: TOOL,
    maxTokens: 700,
  });
  const parsed = repoCardSchema.parse(args);
  return {
    name: parsed.name.trim(),
    tagline: parsed.tagline.trim(),
    building: parsed.building.trim(),
    who: parsed.who.trim(),
    problem: parsed.problem.trim(),
    phase: parsed.phase,
    phaseReason: parsed.phaseReason.trim(),
  };
}

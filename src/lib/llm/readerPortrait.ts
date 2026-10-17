import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

/**
 * Portrait des lecteurs d'un sujet (docs/SPEC_PROMPT_GENERATION_V3.md §2.2, Annexe A.5) : 1 à 3
 * publics, le principal en premier. Une hypothèse de travail que l'auteur corrige ; la génération
 * l'injecte en tête du message (bloc <lecteurs>) et chaque post en vise un seul.
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
  // La phrase « Pour qui » du sujet au moment du portrait : quand elle change, le portrait est à
  // refaire (sauf s'il a été corrigé à la main).
  basedOnAudience: z.string().nullable().default(null),
});
export type ReaderPortrait = z.infer<typeof readerPortraitSchema>;

/** Lecture tolérante d'un jsonb `products.readerPortrait` : null si absent ou illisible. */
export function parseStoredReaderPortrait(raw: unknown): ReaderPortrait | null {
  if (!raw || typeof raw !== "object") return null;
  const result = readerPortraitSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Un portrait est à (re)faire s'il manque, ou si la phrase « Pour qui » a changé depuis — sauf
 *  s'il a été corrigé à la main : seul le bouton « Refaire le portrait » le remplace alors. */
export function portraitIsStale(product: { readerPortrait: unknown; targetAudience: string | null }): boolean {
  const portrait = parseStoredReaderPortrait(product.readerPortrait);
  if (!portrait) return true;
  if (portrait.editedByUser) return false;
  return (portrait.basedOnAudience ?? null) !== (product.targetAudience || null);
}

const TOOL_NAME = "describe_readers";

const describeReadersTool: LlmToolDefinition = {
  name: TOOL_NAME,
  description: "Décrit les 1 à 3 publics d'un projet.",
  input_schema: {
    type: "object",
    properties: {
      readers: {
        type: "array",
        description: "1 à 3 publics, le principal en premier.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Nom court du public, 2 à 4 mots." },
            who: { type: "string", description: "Qui précisément, en une phrase concrète." },
            knows: { type: "string", description: "Ce qu'ils savent déjà du domaine, leur niveau." },
            wants: {
              type: "string",
              description:
                "Ce qu'ils viennent chercher en suivant ce projet, et ce qu'on voudrait qu'ils fassent (essayer, acheter, suivre, ajouter à leur wishlist…).",
            },
            stopsFor: { type: "string", description: "Ce qui les arrête de scroller." },
            turnsOff: { type: "string", description: "Ce qui les fait fuir." },
            words: {
              type: "array",
              description: "3 à 8 mots ou expressions qu'ils emploient vraiment.",
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

// Annexe A.5, verbatim.
const SYSTEM_PROMPT = `Tu dresses le portrait des lecteurs d'un projet, pour que le ghostwriter qui écrira sur ce projet sache à qui il parle.

Règles :
- Un projet a souvent plusieurs publics qui n'attendent pas la même chose : un jeu parle à des joueurs et à d'autres développeurs ; un outil de code à ses utilisateurs et aux curieux de la technique ; un artisan à ses acheteurs et aux passionnés du métier. Donne 1 à 3 publics, seulement ceux à qui ce projet a vraiment intérêt à parler. Le premier est le principal.
- Si l'auteur a dit pour qui il construit, c'est la référence : précise-la, ne la contredis pas.
- Sois concret : « développeurs front qui maintiennent une app React de plus de deux ans », pas « développeurs ».
- Les mots d'un public sont ceux qu'il emploie vraiment entre pairs, pas ceux du marketing.
- C'est une hypothèse de travail que l'auteur corrigera. N'invente aucun fait sur l'auteur ni sur son projet : tu décris seulement ce que ces lecteurs savent, cherchent et fuient.
- Écris en français.`;

export interface ReaderPortraitContext {
  subjectName: string;
  subjectDescription: string | null;
  valueProposition: string | null;
  subjectAudience: string | null;
  brandAudience: string | null;
  activityType: string;
  platforms: string[];
  /** Résumés des documents du sujet (ceux déjà produits pour le rédacteur en chef). */
  materialSummaries: string[];
}

export const MAX_PORTRAIT_SUMMARIES = 15;

export function buildReaderPortraitMessage(ctx: ReaderPortraitContext): string {
  const lines = [
    `Sujet : ${ctx.subjectName}${ctx.subjectDescription ? ` — ${ctx.subjectDescription}` : ""}`,
    ctx.valueProposition ? `Proposition de valeur : ${ctx.valueProposition}` : null,
    `Pour qui, selon l'auteur : ${ctx.subjectAudience || "(non précisé)"}`,
    `Audience générale de l'auteur : ${ctx.brandAudience || "(non précisée)"}`,
    `Ce que fait l'auteur : ${ctx.activityType || "(non précisé)"}`,
    ctx.platforms.length > 0 ? `Plateformes où il publie : ${ctx.platforms.join(", ")}` : null,
    ctx.materialSummaries.length > 0
      ? `Ce que contient sa matière sur ce sujet (résumés) :\n${ctx.materialSummaries
          .slice(0, MAX_PORTRAIT_SUMMARIES)
          .map((s) => `- ${s}`)
          .join("\n")}`
      : "Pas encore de matière résumée sur ce sujet.",
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

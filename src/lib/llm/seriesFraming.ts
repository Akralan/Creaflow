import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

/**
 * Cadrage d'une série par des choix (docs/SPEC_CADRAGE_SERIE.md) : posture, voix, récit, puis une
 * signature. Les options viennent d'un catalogue fixe (des règles stables que le prompt applique) ;
 * le modèle en choisit trois et écrit les extraits à partir d'un vrai moment de la matière.
 */

export const FRAMING_DIMENSIONS = ["posture", "voice", "story"] as const;
export type FramingDimension = (typeof FRAMING_DIMENSIONS)[number];

export interface FramingOption {
  id: string;
  label: string;
  /** Une ligne pour l'auteur, sur la carte. */
  description: string;
  /** La consigne que le prompt de génération applique. */
  rule: string;
}

// Annexe A.1, verbatim.
export const FRAMING_CATALOG: Record<FramingDimension, FramingOption[]> = {
  posture: [
    { id: "coulisses", label: "Les coulisses", description: "Je te montre ce que je fais, y compris ce qui rate.", rule: "Première personne. Montre le travail en train de se faire, avec ses ratés et ses doutes. Pas de leçon générale plaquée : le lecteur tire la sienne." },
    { id: "pedagogue", label: "Le pédagogue", description: "Je t'explique ce que j'ai compris.", rule: "S'adresse au lecteur. Part de ce qu'il sait, ajoute une notion, l'illustre par le cas de l'auteur, finit sur une idée claire qu'il peut réutiliser." },
    { id: "position", label: "La prise de position", description: "Voilà ce que je pense, et pourquoi.", rule: "Une thèse nette dès l'accroche, défendue par les faits de la matière. Assume le désaccord sans caricaturer l'avis inverse." },
    { id: "labo", label: "Le carnet de labo", description: "J'ai testé, voici ce que ça donne.", rule: "Protocole, mesure, résultat, limite. Ton factuel, chiffres en avant, conclusions prudentes." },
    { id: "guide", label: "Le guide", description: "Voici comment faire.", rule: "Mode d'emploi concret tiré de ce que l'auteur a fait : étapes, outils, pièges. Le lecteur doit pouvoir refaire." },
    { id: "compagnon", label: "Le compagnon de route", description: "On avance ensemble.", rule: "Le lecteur est embarqué : « on », vraies questions posées à la communauté, invitation sincère à réagir. Chaleureux, jamais racoleur." },
  ],
  voice: [
    { id: "sobre", label: "Sobre et précise", description: "Peu de mots, les bons.", rule: "Phrases courtes, mots exacts, aucun effet de style, pas d'emoji, pas de point d'exclamation." },
    { id: "parlee", label: "Parlée et directe", description: "Comme à l'oral, entre collègues.", rule: "Le ton de l'oral : tournures simples, expressions familières mesurées, phrases qui s'enchaînent comme on parle." },
    { id: "imagee", label: "Imagée", description: "Une image vaut mieux qu'un concept.", rule: "Au plus une image ou une comparaison par post, concrète et tirée du métier de l'auteur, jamais une métaphore toute faite." },
    { id: "pairs", label: "Entre pairs", description: "Le jargon du métier, assumé.", rule: "Les termes techniques du domaine employés sans les expliquer, comme entre gens du métier." },
    { id: "vulgarisee", label: "Vulgarisée", description: "Compréhensible par tous.", rule: "Chaque terme technique est remplacé par un mot courant ou expliqué en une phrase simple." },
    { id: "chaleureuse", label: "Chaleureuse", description: "Personnelle et sincère.", rule: "Ton personnel ; les émotions et les remerciements seulement quand la matière les contient, jamais inventés." },
  ],
  story: [
    { id: "journal", label: "Le journal", description: "J'ai essayé, ça a cassé, j'ai compris.", rule: "Chronologique : ce que l'auteur a tenté, ce qui s'est passé, ce qu'il en retient, ce qui vient ensuite." },
    { id: "fin", label: "Par la fin", description: "On commence par le résultat, puis on remonte.", rule: "Ouvre sur le résultat ou la conclusion, puis raconte comment on y est arrivé." },
    { id: "probleme", label: "Problème puis solution", description: "Le problème, les tentatives, ce qui a marché.", rule: "Le problème concret d'abord, puis les essais, puis la solution retenue et pourquoi." },
    { id: "avantapres", label: "L'avant / après", description: "Avant, le changement, après.", rule: "L'état d'avant, le changement précis, l'état d'après, ce qui explique l'écart." },
    { id: "question", label: "La question ouverte", description: "Une vraie question, sans conclure.", rule: "Une question que l'auteur se pose vraiment, les pistes qu'il voit, sans trancher ; le lecteur est invité à répondre." },
    { id: "lecons", label: "Les leçons", description: "Ce qu'un moment m'a appris.", rule: "Un seul moment raconté brièvement, puis deux ou trois enseignements qui en découlent, du plus surprenant au plus attendu." },
  ],
};

const DIMENSION_LABEL: Record<FramingDimension, string> = { posture: "posture", voice: "voix", story: "récit" };

export function findFramingOption(dimension: FramingDimension, id: string): FramingOption | null {
  return FRAMING_CATALOG[dimension].find((o) => o.id === id) ?? null;
}

// --- Données stockées ---

export const framingChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  rule: z.string().min(1),
  sample: z.string().default(""),
});
export type FramingChoice = z.infer<typeof framingChoiceSchema>;

export const signatureSchema = z.object({
  text: z.string().trim().min(1).max(160),
  placement: z.enum(["ouverture", "fin", "titre"]),
});

export const seriesFramingSchema = z.object({
  moment: z.object({ title: z.string(), docIds: z.array(z.string()).default([]) }),
  posture: framingChoiceSchema,
  voice: framingChoiceSchema.nullable().default(null),
  story: framingChoiceSchema,
  signature: signatureSchema.nullable().default(null),
  rejected: z
    .array(z.object({ dimension: z.enum(FRAMING_DIMENSIONS), id: z.string(), label: z.string(), sample: z.string() }))
    .default([]),
  remarks: z.array(z.string()).default([]),
  completedAt: z.string().nullable().default(null),
});
export type SeriesFraming = z.infer<typeof seriesFramingSchema>;

export const chosenVoiceSchema = framingChoiceSchema.extend({ chosenAt: z.string().nullable().default(null) });
export type ChosenVoice = z.infer<typeof chosenVoiceSchema>;

export function parseStoredFraming(raw: unknown): SeriesFraming | null {
  if (!raw || typeof raw !== "object") return null;
  const result = seriesFramingSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseStoredChosenVoice(raw: unknown): ChosenVoice | null {
  if (!raw || typeof raw !== "object") return null;
  const result = chosenVoiceSchema.safeParse(raw);
  return result.success ? result.data : null;
}

// --- Proposer les options (Annexe A.2) ---

const OPTIONS_SYSTEM_PROMPT = `Tu aides un auteur à choisir comment raconter une série de posts. On te donne une dimension à choisir (posture, voix ou récit), un catalogue d'options, un moment réel tiré de sa matière, et les choix qu'il a déjà faits.

1. Choisis les 3 options du catalogue les plus pertinentes pour ce sujet et ce public, et les plus DIFFÉRENTES entre elles : l'auteur doit sentir la différence en lisant.
2. Pour chacune, écris un extrait de 3 à 5 phrases courtes, 80 mots au plus (une accroche, le cœur, une fin), qui raconte CE moment selon cette option, en respectant les choix déjà faits. L'auteur doit pouvoir le lire d'un coup d'œil.

Règles :
- Les trois extraits racontent le même moment : seule la manière change.
- N'invente aucun fait au-delà de la matière fournie ; s'il manque une précision, écris [à compléter].
- Pas de tournures creuses : pas de « Découvrez », de question rhétorique d'ouverture, de « ce n'est pas X, c'est Y », de superlatif sans preuve.
- Si l'auteur a laissé une remarque, tiens-en compte.
- Écris en français, à la première personne de l'auteur.`;

export interface FramingContext {
  subjectName: string | null;
  subjectDescription: string | null;
  series: { label: string; description: string; roleLabel: string | null };
  readers: Array<{ label: string; who: string }>;
  moment: { title: string; documents: Array<{ title: string | null; text: string }> };
}

export const MAX_MOMENT_DOC_CHARS = 4000;

export function buildOptionsMessage(params: {
  context: FramingContext;
  dimension: FramingDimension;
  candidates: FramingOption[];
  chosen: { posture?: FramingChoice | null; voice?: FramingChoice | null };
  remark?: string | null;
}): string {
  const { context, dimension, candidates, chosen, remark } = params;
  const lines = [
    context.subjectName ? `Sujet : ${context.subjectName}${context.subjectDescription ? ` — ${context.subjectDescription}` : ""}` : "Sujet : l'activité générale de l'auteur",
    `Série : ${context.series.label} — ${context.series.description} ${context.series.roleLabel ? ` (rôle : ${context.series.roleLabel})` : ""}`,
    context.readers.length ? `Lecteurs : ${context.readers.map((r) => `${r.label} : ${r.who}`).join(" ; ")}` : null,
    `Dimension à choisir : ${DIMENSION_LABEL[dimension]}`,
    `Catalogue :\n${candidates.map((o) => `- ${o.id} — ${o.label} : ${o.rule}`).join("\n")}`,
  ];
  const done = [
    chosen.posture ? `- Posture : ${chosen.posture.label} — ${chosen.posture.rule}` : null,
    chosen.voice ? `- Voix : ${chosen.voice.label} — ${chosen.voice.rule}` : null,
  ].filter(Boolean);
  if (done.length) lines.push(`Choix déjà faits :\n${done.join("\n")}`);
  if (remark?.trim()) lines.push(`Remarque de l'auteur : ${remark.trim()}`);
  lines.push(`Moment raconté : ${context.moment.title}`);
  lines.push(
    context.moment.documents.length
      ? `Matière :\n${context.moment.documents.map((d) => `${d.title ? `[${d.title}]\n` : ""}${d.text.slice(0, MAX_MOMENT_DOC_CHARS)}`).join("\n---\n")}`
      : "Matière : aucune pour l'instant — appuie-toi sur la description du sujet et de la série, sans inventer de fait."
  );
  return lines.filter((l): l is string => l !== null).join("\n");
}

function optionsTool(ids: string[]): LlmToolDefinition {
  return {
    name: "propose_framing_options",
    description: "Propose trois options du catalogue, chacune avec un extrait qui raconte le moment donné.",
    input_schema: {
      type: "object",
      properties: {
        options: {
          type: "array",
          description: "Exactement 3 options, différentes entre elles.",
          items: {
            type: "object",
            properties: {
              id: { type: "string", enum: ids, description: "L'id de l'option, recopié du catalogue." },
              sample: { type: "string", description: "L'extrait de 3 à 5 phrases courtes, 80 mots au plus, qui raconte le moment selon cette option." },
            },
            required: ["id", "sample"],
            additionalProperties: false,
          },
        },
      },
      required: ["options"],
      additionalProperties: false,
    },
  };
}

export interface ProposedOption extends FramingOption {
  sample: string;
}

/** Trois options et leurs extraits. Doublons et ids hors catalogue écartés ; au besoin, complété
 *  par d'autres options du catalogue sans extrait plutôt que d'échouer. */
export async function proposeFramingOptions(params: {
  context: FramingContext;
  dimension: FramingDimension;
  chosen: { posture?: FramingChoice | null; voice?: FramingChoice | null };
  excludeIds?: string[];
  remark?: string | null;
}): Promise<ProposedOption[]> {
  const exclude = new Set(params.excludeIds ?? []);
  let candidates = FRAMING_CATALOG[params.dimension].filter((o) => !exclude.has(o.id));
  // Toutes vues : on repart du catalogue entier, la remarque de l'auteur fera la différence.
  if (candidates.length < 3) candidates = FRAMING_CATALOG[params.dimension];
  const args = await callStructured({
    system: OPTIONS_SYSTEM_PROMPT,
    userMessage: buildOptionsMessage({ ...params, candidates }),
    tool: optionsTool(candidates.map((c) => c.id)),
    maxTokens: 2048,
    strict: true,
  });
  const parsed = z.object({ options: z.array(z.object({ id: z.string(), sample: z.string() })) }).parse(args);
  const seen = new Set<string>();
  const result: ProposedOption[] = [];
  for (const o of parsed.options) {
    const option = candidates.find((c) => c.id === o.id);
    if (!option || seen.has(o.id) || !o.sample.trim()) continue;
    seen.add(o.id);
    result.push({ ...option, sample: o.sample.trim() });
    if (result.length === 3) break;
  }
  return result;
}

// --- Choisir le moment raconté (§1) ---

const MOMENT_SYSTEM_PROMPT = `Parmi ces documents de travail (résumés), choisis LE moment le plus racontable pour un épisode de série : un événement, une décision, un échec, un chiffre marquant, une surprise. Écarte la documentation d'installation, les listes de fonctionnalités et les spécifications sans événement. Donne un titre au moment, en une phrase : ce qui s'est passé.`;

/** Choisit le document dont le moment est le plus racontable — null si aucun ne convient. */
export async function pickFramingMoment(documents: Array<{ id: string; summary: string }>): Promise<{ docId: string; title: string } | null> {
  if (documents.length === 0) return null;
  const args = await callStructured({
    system: MOMENT_SYSTEM_PROMPT,
    userMessage: documents.map((d) => `- [${d.id}] ${d.summary}`).join("\n"),
    tool: {
      name: "pick_moment",
      description: "Choisit le moment le plus racontable.",
      input_schema: {
        type: "object",
        properties: {
          docId: { type: "string", enum: documents.map((d) => d.id), description: "L'id du document choisi." },
          title: { type: "string", description: "Ce qui s'est passé, en une phrase." },
        },
        required: ["docId", "title"],
        additionalProperties: false,
      },
    },
    maxTokens: 512,
    strict: true,
  });
  const parsed = z.object({ docId: z.string(), title: z.string().trim().min(1) }).parse(args);
  return documents.some((d) => d.id === parsed.docId) ? parsed : null;
}

// --- Proposer une signature (Annexe A.3) ---

const SIGNATURE_SYSTEM_PROMPT = `Propose une signature pour cette série : un élément court qui revient à chaque épisode et la rend reconnaissable (une ouverture fixe, une formule de fin, un titre-rubrique, un compteur d'épisode). Elle découle de la posture, de la voix et du récit choisis, et ne doit pas sonner comme un slogan. Une seule proposition, avec sa place et la raison en une phrase.`;

const signatureTool: LlmToolDefinition = {
  name: "propose_signature",
  description: "Propose la signature de la série.",
  input_schema: {
    type: "object",
    properties: {
      text: { type: "string", description: "La signature, courte. {n} pour le numéro d'épisode si besoin." },
      placement: { type: "string", enum: ["ouverture", "fin", "titre"], description: "Où elle se place dans chaque épisode." },
      why: { type: "string", description: "Pourquoi elle va avec ces choix, en une phrase." },
    },
    required: ["text", "placement", "why"],
    additionalProperties: false,
  },
};

export async function proposeSignature(params: {
  context: FramingContext;
  posture: FramingChoice;
  voice: FramingChoice | null;
  story: FramingChoice;
}): Promise<{ text: string; placement: "ouverture" | "fin" | "titre"; why: string }> {
  const lines = [
    `Série : ${params.context.series.label} — ${params.context.series.description}`,
    `Posture : ${params.posture.label} — ${params.posture.rule}`,
    params.voice ? `Voix : ${params.voice.label} — ${params.voice.rule}` : null,
    `Récit : ${params.story.label} — ${params.story.rule}`,
    `Extrait choisi par l'auteur : « ${params.story.sample} »`,
  ].filter(Boolean);
  const args = await callStructured({
    system: SIGNATURE_SYSTEM_PROMPT,
    userMessage: lines.join("\n"),
    tool: signatureTool,
    maxTokens: 512,
    strict: true,
  });
  return z.object({ text: z.string().trim().min(1), placement: z.enum(["ouverture", "fin", "titre"]), why: z.string() }).parse(args);
}

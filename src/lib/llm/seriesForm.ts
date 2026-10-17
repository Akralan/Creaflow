import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import type { Reader } from "./readerPortrait";

/**
 * La forme d'une série pour son lecteur (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4) : réfléchie une
 * fois, avec la ligne de temps sous les yeux, écrite noir sur blanc, corrigeable par l'auteur. Le
 * rédacteur la reçoit telle quelle à chaque post, à la place des rôles, angles et cadrages.
 */

export const seriesFormSchema = z.object({
  /** Ce que ce lecteur vient chercher dans cette série, en deux phrases. */
  wants: z.string().trim().min(1),
  /** De quoi est fait un bon épisode pour lui : une structure concrète, pas des adjectifs. */
  episodeShape: z.string().trim().min(1),
  /** Ce qui le fait partir. */
  avoid: z.string().trim().min(1),
  /** Les mots qu'il emploie. */
  words: z.array(z.string().trim().min(1)).max(12).default([]),
  /** Les mots qu'il ne comprend pas, à bannir ou à expliquer. */
  jargon: z.array(z.string().trim().min(1)).max(12).default([]),
  /** Longueur et registre qui lui conviennent sur la plateforme de la série. */
  register: z.string().trim().min(1),
  generatedAt: z.string().nullable().default(null),
  editedByUser: z.boolean().default(false),
});
export type SeriesForm = z.infer<typeof seriesFormSchema>;

/** Lecture tolérante d'un jsonb `content_series.form` : null si absent ou illisible. */
export function parseStoredSeriesForm(raw: unknown): SeriesForm | null {
  if (!raw || typeof raw !== "object") return null;
  const result = seriesFormSchema.safeParse(raw);
  return result.success ? result.data : null;
}

const TOOL_NAME = "describe_series_form";

const describeSeriesFormTool: LlmToolDefinition = {
  name: TOOL_NAME,
  description: "Écrit la forme d'une série pour son lecteur.",
  input_schema: {
    type: "object",
    properties: {
      wants: { type: "string", description: "Ce que ce lecteur vient chercher dans cette série, en deux phrases, concrètes." },
      episodeShape: {
        type: "string",
        description:
          "De quoi est fait un bon épisode pour lui : la structure, étape par étape, avec un exemple pris dans les événements fournis. Pas d'adjectifs, des éléments qu'on peut vérifier dans le post.",
      },
      avoid: { type: "string", description: "Ce qui le fait partir, en une ou deux phrases précises." },
      words: { type: "array", items: { type: "string" }, description: "6 à 12 mots ou expressions qu'il emploie vraiment." },
      jargon: { type: "array", items: { type: "string" }, description: "Les mots du projet qu'il ne comprend pas (à éviter ou à expliquer). Vide s'il est du métier." },
      register: { type: "string", description: "Longueur et registre pour lui sur la plateforme : nombre de lignes, tutoiement ou non, première personne, ce qu'on ne fait pas." },
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
  /** Titres d'événements réels de la ligne de temps, pour ancrer les exemples. */
  sampleEvents: string[];
}

function buildSystemPrompt(context: SeriesFormContext): string {
  return `Tu prépares le travail d'un ghostwriter. ${context.brandName} (${context.activityType}) raconte ${context.subjectName} dans une série de posts, « ${context.seriesLabel} », écrite pour UN SEUL lecteur. Tu écris la forme de cette série pour ce lecteur : ce qu'il vient y chercher, de quoi est fait un bon épisode pour lui, ce qui le fait partir, ses mots, la longueur et le registre.

Un bon épisode, c'est un événement raconté : ce qui s'est passé, ce que ça a changé, pour cette personne-là. La forme dit comment on le raconte à CE lecteur. Deux exemples fictifs de ce qu'on attend, pour deux lecteurs différents d'un même projet (ne les recopie pas, ils servent à montrer le niveau de précision) :
- celui qui utilise ce que l'auteur construit (un client, un joueur, un patient…) : « une situation précise vécue par quelqu'un comme lui, ce qui n'allait pas, ce que le produit a montré ou permis, ce que cette personne a fait ensuite, en six à dix lignes, sans un mot de technique » ;
- un pair de l'auteur (un autre développeur, un autre artisan…) : « ce qu'on croyait, ce qui a cassé, ce qu'on a changé, le chiffre avant et après, en dix à quinze lignes, avec le nom des outils ».
Écris pour le lecteur fourni, à partir de qui il est vraiment, et appuie l'exemple de structure sur un des événements réels listés. Ne décris jamais le projet lui-même : décris comment on le raconte.`;
}

function buildUserMessage(context: SeriesFormContext): string {
  const r = context.reader;
  const lines = [
    `Série : ${context.seriesLabel} — ${context.seriesDescription}`,
    `Sujet : ${context.subjectName}${context.subjectDescription ? ` — ${context.subjectDescription}` : ""}`,
    `Plateformes : ${context.platforms.join(", ") || "non précisées"}`,
    "",
    `Lecteur : ${r.label} — ${r.who}`,
    r.knows ? `Sait déjà : ${r.knows}` : null,
    r.wants ? `Vient chercher : ${r.wants}` : null,
    r.stopsFor ? `S'arrête pour : ${r.stopsFor}` : null,
    r.turnsOff ? `Fuit : ${r.turnsOff}` : null,
    r.words.length ? `Ses mots : ${r.words.join(", ")}` : null,
    "",
    context.sampleEvents.length
      ? `Événements réels de la ligne de temps du sujet (pour ancrer l'exemple de structure) :\n${context.sampleEvents.map((t) => `- ${t}`).join("\n")}`
      : "Aucun événement enregistré pour l'instant : décris la structure sans exemple tiré de la matière.",
    "",
    `Écris la forme de la série via ${TOOL_NAME}.`,
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

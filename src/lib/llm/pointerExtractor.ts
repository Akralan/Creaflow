/**
 * Extracteur de pointeurs — l'événement réduit à son adresse, plus son genre.
 *
 * Décision du 2026-10-22 (worktree `evenements-pointeurs`) : un événement n'a PLUS AUCUN CHAMP.
 * Ni titre, ni `whatHappened`, ni `whatChanged`, ni `audiences`, ni `excerpt`. Un événement est un
 * fichier, une ligne, et la date si la ligne en porte une. Celui qui veut savoir ce qu'il y a dans
 * l'événement ouvre le fichier à cette ligne.
 *
 * Décision du 2026-10-24 (docs/FORMES_ET_GENRES.md) : UNE exception, le `genre` — ce qu'est le fait,
 * parmi treize valeurs fermées — avec ses deux compléments `disponible` et `tient`. C'est une
 * classification faite dans le même appel que la ligne, pas un résumé. La forme du post qui
 * racontera l'événement en découle (postForms.ts).
 *
 * L'extracteur n'est donc pas agentique : une passe par part de document, un appel structuré,
 * une liste de lignes et de genres. Il ne résume rien, il adresse et il classe.
 */
import { z } from "zod";
import { callStructured } from "@/lib/llm/provider";
import type { LlmToolDefinition } from "@/lib/llm/types";
import { GENRES, isGenre, type Genre, type HoldableGenre } from "./postForms";

/** Une part de document envoyée en un appel. Plus large que les 12 000 du lecteur d'événements :
 *  l'extracteur ne rédige rien, sa sortie est une liste d'entiers et de mots fermés. */
export const PART_CHARS = 40_000;

/** Plafond de la liste ouverte envoyée à chaque appel (règle 14) : les plus récents d'abord. */
export const OPEN_CAP = 40;

/** Budget de sortie par part. À 4 096, une part de 40 000 caractères riche en événements débordait
 *  depuis que chaque entrée porte cinq champs (mesuré le 2026-10-24 sur le dépôt de tellovo : JSON
 *  tronqué à ~12 700 caractères, le document entier perdu). */
export const MAX_OUTPUT_TOKENS = 16_384;

export interface Pointer {
  /** Nom du document, tel qu'il est déposé dans la matière. */
  file: string;
  /** Numéro de ligne, à partir de 1, dans le document entier. */
  line: number;
  /** ISO (YYYY-MM-DD) quand la ligne en porte une, sinon null. */
  date: string | null;
  /** Ce qu'est le fait (docs/FORMES_ET_GENRES.md Partie 1). Jamais vide : `livraison` par défaut. */
  genre: Genre;
  /** Une `livraison` utilisable par d'autres que l'auteur. Toujours faux hors `livraison`. */
  disponible: boolean;
  /** L'id d'un événement de la liste ouverte que celui-ci réalise ou sur lequel il revient. */
  tient: string | null;
}

/** Un engagement, une annonce ou une décision du sujet qu'un nouvel événement peut « tenir ». */
export interface OpenEvent {
  id: string;
  genre: HoldableGenre;
  date: string | null;
  /** Le texte de la ligne pointée, pour que le lecteur sache ce qui était promis ou décidé. */
  text: string;
}

const recordedSchema = z.object({
  events: z
    .array(
      z.object({
        line: z.number().int().positive(),
        date: z.string(),
        genre: z.string().optional(),
        available: z.boolean().optional(),
        fulfills: z.string().optional(),
      })
    )
    .default([]),
});

export const RECORD_TOOL = "record_events";

export function buildExtractorTool(): LlmToolDefinition {
  return {
    name: RECORD_TOOL,
    description: "Records where the events of this document are, and what kind of fact each one is. One entry per event.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          description: "One entry per event found in the part you were given. Empty if there is none.",
          items: {
            type: "object",
            properties: {
              line: { type: "number", description: "The line number of the event, as printed at the start of the line." },
              date: { type: "string", description: "The date the line carries, as YYYY-MM-DD. Empty string if the line carries none." },
              genre: { type: "string", enum: [...GENRES], description: "What kind of fact this is. One of the thirteen genres, by their rules." },
              available: {
                type: "boolean",
                description: "True only for a livraison that others than the author can use, when the line says where, for whom or how. False otherwise.",
              },
              fulfills: {
                type: "string",
                description:
                  "The id of an open engagement, annonce or décision (from the <open> list) that this event fulfills or looks back on. Empty string if none.",
              },
            },
            required: ["line", "date", "genre", "available", "fulfills"],
            additionalProperties: false,
          },
        },
      },
      required: ["events"],
      additionalProperties: false,
    },
  };
}

/**
 * LA seule phrase de définition du prompt. Elle est isolée ici exprès : c'est le seul endroit où
 * l'extracteur apprend ce qu'est un événement, donc le seul levier si le relevé est mauvais.
 */
// 2026-10-26 : « where something happened » donnait 1 880 événements sur le dépôt tellovo, dont des
// renommages et des « tests verts ». Le choix du fait se fait ici, en amont (docs/tests/POSTS_OBJECTIFS.md).
export const EVENT_DEFINITION =
  "An event is a line of this document where something happened that the author could tell as a story to someone outside the project: something was hoped, risked, lost, found, decided against the odds, or surprised them. A change in the machinery alone is not an event: renaming, refactoring, moving a file, tests passing, a migration applied, a detail of a screen.";

/** Le seuil (2026-10-26) : aucun quota par document — un document peut en porter douze — mais un tri
 *  sur l'intérêt de la ligne. La définition seule n'avait retiré qu'un pointeur sur cinq (1 880 → 1 484). */
export const EVENT_THRESHOLD =
  "Most lines of a working document are not events, and many documents hold none: plans, specifications and reference pages mostly describe how things will work, not what happened. Mark a line only if a stranger would want to hear about it — and mark every such line, however many there are.";

/** La nature du document d'abord (2026-10-26) : 184 pointeurs venaient du catalogue des posts d'autres
 *  auteurs, pris pour des faits du projet, et les specs donnaient leurs règles comme des décisions. */
/** La taille d'un événement (2026-10-26) : une décision racontée sur onze lignes d'une spec donnait
 *  onze pointeurs, dont les routes et la colonne qui ressortaient ensuite dans les posts. */
export const EVENT_SIZE =
  "An event is a story, not a detail of one. When several lines — here or in the list of facts already marked — tell the same story, it is one event: mark only the line that tells it best, or nothing if it is already marked.";

export const DOCUMENT_NATURE =
  "First decide what this document is. If it is about other people's work — a catalogue, research, collected posts — it holds no event of this project: mark nothing. If it describes how something works — a specification, a guide — mark only what the author lived while making it, not the rules it states: in a specification, the lived moments are where the author's own words or a dated decision with its reason appear. If it summarises other documents of this project — an index, a table of contents, a list of the docs and what each one says — it holds no event: the facts are in those documents. Mark nothing.";

/**
 * Les treize genres et leurs règles (docs/FORMES_ET_GENRES.md Partie 1), première version pour le
 * banc. Ce qui sort du banc fait foi et remonte dans docs/PROMPTS.md.
 */
export const GENRE_RULES = `<genres>
Each event has exactly one genre: what kind of fact it is. Each genre has a minimum condition; without it, it is not that genre. The condition must be met in the line or its immediate neighbourhood, not inferred from the rest of the material.

On the product:
- livraison — something works or exists that did not before. Condition: a before and an after in the source. The DEFAULT for any fact about the product.
- annonce — a delivery whose availability date is set but not reached. Condition: a precise date or delay, and the thing is not accessible yet. An announcement without a date is nothing (a livraison not yet available).
- décision — a choice between at least two options, one of them taken. Condition: the option taken and at least one discarded are named.
- question — a choice the author has not made yet and asks about. Condition: options named AND an explicit sentence of doubt or request. A decision taken is never a question.
- chiffre — a number that situates the project (not the market). Condition: the number is about the author's project, with its date. Market data is a leçon, not a chiffre.
- échec — what was expected did not happen. Condition: the expectation and the gap are both in the source.
- leçon — the author states a rule drawn from a fact. Condition: the rule is written by the author. If you would have to phrase it yourself, it is a livraison or an échec.
- engagement — the author commits to a future fact. Condition: first person, future, AND a deadline or a number in the line. "We'll soon…", "we're thinking about…", "I'd like…" are NOT engagements; when in doubt, décision.
- offre — the author offers something to specific people in exchange for an action. Condition: what is offered, to whom, and the expected action. "We launched a promo" without the action is a livraison available.
- retour_utilisateur — someone outside the team did or said something with the product. Condition: the person is identifiable (first name, role or company). "Users love it" is not one.
- déclencheur — the fact that started the project. Condition: earlier than any delivery; tells a problem, not a solution.

On the author and their surroundings:
- coulisse — a dated fact lived by the author that is not about the product. The DEFAULT for any fact not about the product. A character trait is not an event.
- réaction — the author commented on content that is not theirs. Condition: the content is identified (title, author or link) AND the author wrote at least one sentence about it. A saved link without a comment is not an event.

Rules:
1. One genre per event. A line holding a delivery and a number is two events, not one event with two genres.
2. When a fact hesitates between genres, the rarer wins: engagement > échec > retour_utilisateur > offre > annonce > question > chiffre > décision > leçon > réaction > coulisse > livraison.
3. The genre is never empty.
4. available: true only on a livraison, and only when the line says where, for whom or how others reach it.
5. fulfills: the <open> list gives the subject's open engagements, annonces and décisions. Set fulfills to one of their ids ONLY if this event realises what was promised or announced, or explicitly looks back on that decision (the line says it is kept, dropped, or what it gave). No interpretation. A partially kept engagement is not kept. Otherwise empty.
</genres>`;

export function buildExtractorSystemPrompt(): string {
  return `You read one document and you mark where its events are, and what kind of fact each one is.

${EVENT_DEFINITION} ${EVENT_THRESHOLD} ${EVENT_SIZE}

${DOCUMENT_NATURE}

You record nothing about an event — no title, no summary, no consequence, no audience — except its line number, the date if the line carries one, and its genre: what kind of fact it is, one of thirteen, defined below. Whoever uses it later opens the document at that line and reads it themselves.

${GENRE_RULES}

Answer with ${RECORD_TOOL}.`;
}

/** Numérote le document en entier, puis le coupe en parts de lignes entières. Les numéros sont ceux
 *  du document complet : une part n'est jamais renumérotée, sinon le pointeur ne pointe sur rien. */
export function numberAndSplit(text: string, partChars = PART_CHARS): string[] {
  const numbered = text.split("\n").map((line, i) => `${i + 1}\t${line}`);
  const parts: string[] = [];
  let current: string[] = [];
  let size = 0;
  for (const line of numbered) {
    if (size > 0 && size + line.length + 1 > partChars) {
      parts.push(current.join("\n"));
      current = [];
      size = 0;
    }
    current.push(line);
    size += line.length + 1;
  }
  if (current.length > 0) parts.push(current.join("\n"));
  return parts;
}

/** Un fait déjà marqué dans un autre document du projet, avec le texte de sa ligne. */
export interface KnownFact {
  file: string;
  line: number;
  text: string;
}

/** Longueur gardée de chaque fait connu : assez pour reconnaître le fait, pas pour le raconter. */
export const KNOWN_FACT_CHARS = 160;

/**
 * Le bloc <already_marked> (2026-10-26) : un même fait écrit dans le devlog, l'index et un commit
 * donnait trois pointeurs, et le rédacteur racontait trois fois la même histoire. Les journaux sont
 * lus d'abord (materialEventService), donc c'est leur version, vécue et détaillée, qui reste.
 */
export function knownBlock(known: KnownFact[]): string {
  if (known.length === 0) return "";
  const rows = known.map((k) => `${k.file}:${k.line} · ${k.text.trim().slice(0, KNOWN_FACT_CHARS)}`);
  return `\n\n<already_marked>\nA fact already in this list is not a new event, even told in other words or with more detail: do not mark it again.\n${rows.join("\n")}\n</already_marked>`;
}

/** Le bloc <open> du message utilisateur : rien quand la liste est vide. */
export function openBlock(open: OpenEvent[]): string {
  if (open.length === 0) return "";
  const rows = open.slice(0, OPEN_CAP).map((o) => `[${o.id}] ${o.genre} · ${o.date ?? "no date"} · ${o.text.trim()}`);
  return `\n\n<open>\n${rows.join("\n")}\n</open>`;
}

type RawEvent = z.infer<typeof recordedSchema>["events"][number];

/**
 * Les contrôles du code sur une entrée du modèle (docs/FORMES_ET_GENRES.md, critères du lecteur) :
 * ligne hors du document → écartée ; date non ISO → null ; genre inconnu → `livraison` ;
 * `engagement` sans chiffre dans la ligne → `décision` (règle 4 : le genre à ne pas inventer) ;
 * `available` gardé sur `livraison` seulement ; `fulfills` hors de la liste ouverte → null.
 */
export function normalizePointer(
  raw: RawEvent,
  ctx: { file: string; lines: string[]; openIds: Set<string> }
): Pointer | null {
  if (raw.line < 1 || raw.line > ctx.lines.length) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw.date.trim()) ? raw.date.trim() : null;
  let genre: Genre = isGenre(raw.genre) ? raw.genre : "livraison";
  if (genre === "engagement" && !/\d/.test(ctx.lines[raw.line - 1] ?? "")) genre = "décision";
  const disponible = genre === "livraison" && raw.available === true;
  const fulfills = (raw.fulfills ?? "").trim();
  const tient = fulfills.length > 0 && ctx.openIds.has(fulfills) ? fulfills : null;
  return { file: ctx.file, line: raw.line, date, genre, disponible, tient };
}

/** Les pointeurs d'un document. `file` est le nom du document, il n'est jamais demandé au modèle. */
export async function extractPointers(
  doc: { file: string; text: string },
  open: OpenEvent[] = [],
  known: KnownFact[] = []
): Promise<{ pointers: Pointer[]; calls: number }> {
  const parts = numberAndSplit(doc.text);
  const tool = buildExtractorTool();
  const system = buildExtractorSystemPrompt();
  const lines = doc.text.split("\n");
  const openIds = new Set(open.slice(0, OPEN_CAP).map((o) => o.id));
  const pointers: Pointer[] = [];

  for (const [i, part] of parts.entries()) {
    const raw = await callStructured({
      system,
      userMessage: `Document: ${doc.file}\nPart ${i + 1} of ${parts.length}. Line numbers are those of the whole document.${openBlock(open)}${knownBlock(known)}\n\n${part}`,
      tool,
      maxTokens: MAX_OUTPUT_TOKENS,
      strict: true,
    });
    const parsed = recordedSchema.safeParse(raw);
    if (!parsed.success) continue;
    for (const e of parsed.data.events) {
      const pointer = normalizePointer(e, { file: doc.file, lines, openIds });
      if (pointer) pointers.push(pointer);
    }
  }

  // Un même numéro de ligne rendu deux fois par deux parts qui se chevauchent au bord : on garde un.
  const seen = new Set<number>();
  const unique = pointers.filter((p) => (seen.has(p.line) ? false : (seen.add(p.line), true)));
  return { pointers: unique, calls: parts.length };
}

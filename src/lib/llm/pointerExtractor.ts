/**
 * Extracteur de pointeurs — l'événement réduit à son adresse.
 *
 * Décision du 2026-10-22 (worktree `evenements-pointeurs`) : un événement n'a PLUS AUCUN CHAMP.
 * Ni titre, ni `whatHappened`, ni `whatChanged`, ni `kind`, ni `audiences`, ni `audienceAngles`,
 * ni `excerpt`. Un événement est un fichier, une ligne, et la date si la ligne en porte une.
 * Rien d'autre, et il n'y a rien d'autre à rajouter plus tard : celui qui veut savoir ce qu'il y a
 * dans l'événement ouvre le fichier à cette ligne.
 *
 * L'extracteur n'est donc pas agentique : une passe par part de document, un appel structuré,
 * une liste de numéros de ligne. Il ne juge rien, il adresse.
 */
import { z } from "zod";
import { callStructured } from "@/lib/llm/provider";
import type { LlmToolDefinition } from "@/lib/llm/types";

/** Une part de document envoyée en un appel. Plus large que les 12 000 du lecteur d'événements :
 *  l'extracteur ne rédige rien, sa sortie est une liste d'entiers. */
export const PART_CHARS = 40_000;

export interface Pointer {
  /** Nom du document, tel qu'il est déposé dans la matière. */
  file: string;
  /** Numéro de ligne, à partir de 1, dans le document entier. */
  line: number;
  /** ISO (YYYY-MM-DD) quand la ligne en porte une, sinon null. */
  date: string | null;
}

const recordedSchema = z.object({
  events: z.array(z.object({ line: z.number().int().positive(), date: z.string() })).default([]),
});

export const RECORD_TOOL = "record_events";

export function buildExtractorTool(): LlmToolDefinition {
  return {
    name: RECORD_TOOL,
    description: "Records where the events of this document are. One entry per event.",
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
            },
            required: ["line", "date"],
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
export const EVENT_DEFINITION = "An event is a line of this document where something happened.";

export function buildExtractorSystemPrompt(): string {
  return `You read one document and you mark where its events are.

${EVENT_DEFINITION}

You record nothing about an event: no title, no summary, no consequence, no audience. Only its line number, and the date if the line carries one. Whoever uses it later opens the document at that line and reads it themselves.

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

/** Les pointeurs d'un document. `file` est le nom du document, il n'est jamais demandé au modèle. */
export async function extractPointers(doc: { file: string; text: string }): Promise<{ pointers: Pointer[]; calls: number }> {
  const parts = numberAndSplit(doc.text);
  const tool = buildExtractorTool();
  const system = buildExtractorSystemPrompt();
  const totalLines = doc.text.split("\n").length;
  const pointers: Pointer[] = [];

  for (const [i, part] of parts.entries()) {
    const raw = await callStructured({
      system,
      userMessage: `Document: ${doc.file}\nPart ${i + 1} of ${parts.length}. Line numbers are those of the whole document.\n\n${part}`,
      tool,
      maxTokens: 4096,
      strict: true,
    });
    const parsed = recordedSchema.safeParse(raw);
    if (!parsed.success) continue;
    for (const e of parsed.data.events) {
      if (e.line < 1 || e.line > totalLines) continue;
      const date = /^\d{4}-\d{2}-\d{2}$/.test(e.date.trim()) ? e.date.trim() : null;
      pointers.push({ file: doc.file, line: e.line, date });
    }
  }

  // Un même numéro de ligne rendu deux fois par deux parts qui se chevauchent au bord : on garde un.
  const seen = new Set<number>();
  const unique = pointers.filter((p) => (seen.has(p.line) ? false : (seen.add(p.line), true)));
  return { pointers: unique, calls: parts.length };
}

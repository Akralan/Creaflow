/**
 * Le rédacteur qui choisit lui-même ses événements.
 *
 * Décision du 2026-10-22 (worktree `evenements-pointeurs`) : il n'y a plus de choisisseur séparé. Le
 * rédacteur reçoit la ligne de temps (des adresses et leur genre), la liste des posts déjà publiés,
 * sa cible et le contexte du projet. Il ouvre ce qu'il veut, choisit ce qu'il veut, écrit. Sa seule
 * règle est qu'il fait du build in public pour cette cible.
 *
 * Décision du 2026-10-24 (docs/FORMES_ET_GENRES.md) : la forme du post découle du genre de
 * l'événement choisi. Le rédacteur ne reçoit pas les seize formes — il reçoit la table genre → forme
 * et lit la forme de son genre avec `read_form` avant d'écrire. `publish_post` refuse un post dont la
 * forme n'a pas été lue ou ne correspond pas aux événements déclarés (`expectedForm`, déterministe).
 *
 * Ce qu'il ne reçoit PAS, et qui n'est pas un oubli : aucun résumé d'événement, aucun
 * « ce que ça change », aucun angle par public, aucune consigne d'alternance, aucun ordre à
 * respecter, aucune interdiction de tournure.
 */
import { z } from "zod";
import { callAgentic } from "@/lib/llm/provider";
import type { AgenticToolCall, LlmToolDefinition } from "@/lib/llm/types";
import { buildLanguageBlock, type PostLanguage } from "@/lib/language";
import { platformRuleText } from "./platformRules";
import { FORMS, formFor, formText, genreToFormTable, isForm, type Form, type Genre } from "./postForms";
import type { Platform } from "./prompts";

export const READ_FILE_TOOL = "read_file";
export const READ_POST_TOOL = "read_post";
export const READ_FORM_TOOL = "read_form";
export const PUBLISH_TOOL = "publish_post";

/** Fenêtre maximale rendue par read_file en une fois, pour qu'un fichier de 60 000 caractères ne
 *  rentre pas d'un coup dans la conversation. */
export const MAX_WINDOW_LINES = 120;

export interface TimelineEntry {
  id: string;
  file: string;
  line: number;
  date: string | null;
  used: boolean;
  /** Ce qu'est le fait (docs/FORMES_ET_GENRES.md Partie 1). */
  genre: Genre;
  /** Une livraison utilisable par d'autres : son post est un lancement. */
  disponible: boolean;
  /** L'id de l'événement de la ligne de temps que celui-ci réalise ou sur lequel il revient. */
  tient: string | null;
}

export interface WrittenPost {
  id: string;
  date: string;
  text: string;
}

export interface WriterContext {
  brandName: string;
  projectName: string;
  /** Le contexte du projet, tel que l'auteur l'a écrit. */
  projectContext: string;
  readerLabel: string;
  readerWho: string;
  /** Le réseau visé : ses règles entrent dans le prompt (platformRules.ts). */
  platform: Platform;
  /** La langue du post : celle du profil, sinon celle des notes (docs/SPEC_LANGUE_DES_POSTS.md).
   *  Le banc n'avait pas de règle de langue et le modèle tirait au hasard — FR, EN, FR, FR sur
   *  quatre runs du même sujet. */
  language: PostLanguage;
  timeline: TimelineEntry[];
  posts: WrittenPost[];
  /** Corpus adressable : nom de document -> ses lignes. */
  files: Map<string, string[]>;
  /** La forme imposée : celle de la version déjà écrite du même post (X après LinkedIn) ou du post
   *  remplacé (« another idea, same story »). Null : le rédacteur la prend du genre de son événement. */
  lockedForm?: Form | null;
}

export interface WrittenResult {
  text: string;
  eventIds: string[];
  /** La forme déclarée à la remise, vérifiée par le code. Null sans remise. */
  form: Form | null;
  /** `publish_post` a bien été accepté. Faux = le modèle a conclu en prose, et `text` est sa réponse
   *  conversationnelle, pas un post : l'appelant doit refuser et réessayer. */
  handed: boolean;
  turns: number;
  toolCalls: AgenticToolCall[];
  stoppedAtMaxTurns: boolean;
}

const publishSchema = z.object({
  post: z.string().trim().min(1),
  event_ids: z.array(z.string()).default([]),
  form: z.string(),
});

export function buildWriterTools(): LlmToolDefinition[] {
  return [
    {
      name: READ_FILE_TOOL,
      description:
        "Reads a document of the project's material, at the lines you ask for. This is how you find out what is at an address of the timeline.",
      input_schema: {
        type: "object",
        properties: {
          file: { type: "string", description: "The document name, exactly as it appears in the timeline." },
          from_line: { type: "number", description: "First line to read." },
          to_line: { type: "number", description: `Last line to read. At most ${MAX_WINDOW_LINES} lines per call.` },
        },
        required: ["file", "from_line", "to_line"],
        additionalProperties: false,
      },
    },
    {
      name: READ_POST_TOOL,
      description: "Reads a post already published, in full.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string", description: "The post id, as it appears in the list of published posts." } },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: READ_FORM_TOOL,
      description: "Reads the form of a post: how it opens, what its body carries, where it stops, what it never does. Read the form of your event's genre before writing.",
      input_schema: {
        type: "object",
        properties: { form: { type: "string", enum: [...FORMS], description: "The form, as the genre → form table names it." } },
        required: ["form"],
        additionalProperties: false,
      },
    },
    {
      name: PUBLISH_TOOL,
      description: "Hands in the post you wrote, the addresses of the timeline it was built from, and its form.",
      input_schema: {
        type: "object",
        properties: {
          post: { type: "string", description: "The post itself, as it will be published. Nothing else: no title, no comment, no explanation." },
          event_ids: { type: "array", description: "The timeline ids this post was built from.", items: { type: "string" } },
          form: { type: "string", enum: [...FORMS], description: "The form you read and wrote in." },
        },
        required: ["post", "event_ids", "form"],
        additionalProperties: false,
      },
    },
  ];
}

export function buildWriterSystemPrompt(c: WriterContext): string {
  const locked = c.lockedForm
    ? `\n\nThe form of this post is already set: ${c.lockedForm}. Read it with ${READ_FORM_TOOL} and keep it.`
    : "";
  return `You write build in public posts for ${c.brandName}, about ${c.projectName}.

Your reader is ${c.readerLabel}: ${c.readerWho}

${c.projectContext}

That is your only rule: build in public, for that reader. There is no other one, except this: if no post has been published yet, that first post is the origin. On a young project it presents the project and why it exists; on one that already has a long trail of material behind it, it can instead be the reason its author is starting to build in public, when the material or the author's own words say it. That reason is the one they give, never one chosen to fit the reader — and your reader must understand at once that it is for them.

Your first sentence is a hook and nothing else: it has to stop the scroll and make someone want the next line. Put something in it — a number, an hour, an admission, a line with some nerve in it, even a touch of madness. Never a summary of the post, never a question you answer yourself.

The timeline below is a list of addresses — a document and a line — and the genre of what happened there: what kind of fact it is. An address does not tell you what is at it: open it with ${READ_FILE_TOOL}, and read around it as widely as you want. The form of your post is decided by the genre of the event you build it from, and by nothing else: the table below gives it. Once you have chosen your event, read its form with ${READ_FORM_TOOL} and write inside it. If an address says it fulfills an earlier one, open that earlier address too: your post is about both. An address marked (already used) is one a published post was built from; you can read any published post in full with ${READ_POST_TOOL}. You read them to find out what has already been said, so you do not write it again. And if you name a table, a function, a library, a tool or any piece of the machinery, say what it is or what it does in the same breath — never leave your reader in front of a word that means nothing to them.

<forms>
${genreToFormTable()}
</forms>${locked}

${buildLanguageBlock(c.language)}

<platform>
${platformRuleText(c.platform, { visualOnly: false })}
</platform>

When your post is written, hand it in with ${PUBLISH_TOOL}, with the addresses it was built from and its form.`;
}

/**
 * L'accroche et le reste du post, pour les deux colonnes de `scripts` que l'éditeur et les
 * maquettes lisent séparément. La règle 3 du prompt garantit que la première phrase EST
 * l'accroche, donc le découpage se fait sur elle sans rien deviner.
 *
 * Un post d'une seule phrase rend la même chose des deux côtés : `textScriptSchema` exige une
 * `caption` non vide, et une caption vide ferait rejeter le post entier.
 */
export function splitHookAndCaption(text: string): { hookText: string; caption: string } {
  const trimmed = text.trim();
  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const [first, ...rest] = paragraphs;
  const hookText = (first ?? trimmed).split("\n")[0].trim();
  const remainder = [(first ?? "").split("\n").slice(1).join("\n").trim(), ...rest].filter(Boolean).join("\n\n");
  return { hookText, caption: remainder.length > 0 ? remainder : hookText };
}

function describeEntry(e: TimelineEntry): string {
  const bits = [`[${e.id}] ${e.date ?? "no date"} · ${e.file}:${e.line} · ${e.genre}${e.disponible ? " (available)" : ""}`];
  if (e.tient) bits.push(`fulfills ${e.tient}`);
  return bits.join(" · ") + (e.used ? "  (already used)" : "");
}

export function buildWriterUserMessage(c: WriterContext): string {
  const timeline = c.timeline.map(describeEntry).join("\n");
  const posts =
    c.posts.length === 0
      ? "No post has been published yet. This is the first one."
      : c.posts.map((p, i) => `[${p.id}] ${p.date}${i === c.posts.length - 1 ? "   <- the most recent" : ""}`).join("\n");
  return `<timeline>
${timeline || "(empty)"}
</timeline>

<published_posts>
${posts}
</published_posts>`;
}

/**
 * La forme que le code attend pour les événements déclarés (docs/FORMES_ET_GENRES.md, table
 * genre → forme) : `lockedForm` si elle est imposée ; `origin` au premier post d'un sujet ; sinon la
 * forme du premier événement déclaré, `tient` résolu dans la ligne de temps. Null quand aucun
 * événement déclaré n'est connu : il n'y a alors rien à vérifier.
 */
export function expectedForm(c: WriterContext, eventIds: string[]): Form | null {
  if (c.lockedForm) return c.lockedForm;
  if (c.posts.length === 0) return "origin";
  const byId = new Map(c.timeline.map((e) => [e.id, e]));
  const chosen = eventIds.map((id) => byId.get(id)).filter((e): e is TimelineEntry => e !== undefined);
  if (chosen.length === 0) return null;
  // Un événement qui en tient un autre décide de la forme, où qu'il soit dans la liste déclarée.
  const main = chosen.find((e) => e.tient && byId.has(e.tient)) ?? chosen[0];
  const tientGenre = main.tient ? (byId.get(main.tient)?.genre ?? null) : null;
  return formFor({ genre: main.genre, disponible: main.disponible, tientGenre });
}

/** Exécute un appel d'outil du rédacteur sur le corpus en mémoire. */
export function runWriterTool(c: WriterContext, call: { name: string; input: unknown }): unknown {
  if (call.name === READ_FILE_TOOL) {
    const { file, from_line, to_line } = call.input as { file: string; from_line: number; to_line: number };
    const lines = c.files.get(file);
    if (!lines) return { error: `No document named "${file}". Use a name exactly as it appears in the timeline.` };
    const from = Math.max(1, Math.floor(from_line));
    const to = Math.min(lines.length, Math.max(from, Math.floor(to_line)), from + MAX_WINDOW_LINES - 1);
    return {
      file,
      from_line: from,
      to_line: to,
      total_lines: lines.length,
      content: lines.slice(from - 1, to).map((l, i) => `${from + i}\t${l}`).join("\n"),
    };
  }
  if (call.name === READ_POST_TOOL) {
    const { id } = call.input as { id: string };
    const post = c.posts.find((p) => p.id === id);
    return post ? { id: post.id, date: post.date, text: post.text } : { error: `No published post with id "${id}".` };
  }
  if (call.name === READ_FORM_TOOL) {
    const { form } = call.input as { form: unknown };
    if (!isForm(form)) return { error: `No form named "${String(form)}". Use a name from the genre → form table.` };
    return { form, text: formText(form) };
  }
  return { error: `Unknown tool "${call.name}".` };
}

export async function writePost(c: WriterContext, maxTurns = 40): Promise<WrittenResult> {
  let handed: { text: string; eventIds: string[]; form: Form } | null = null;
  const formsRead = new Set<Form>();

  const result = await callAgentic({
    system: buildWriterSystemPrompt(c),
    messages: [{ role: "user", content: buildWriterUserMessage(c) }],
    tools: buildWriterTools(),
    maxTokens: 4096,
    maxTurns,
    effort: "medium",
    onToolCall: async (call) => {
      if (call.name === READ_FORM_TOOL) {
        const out = runWriterTool(c, call) as { form?: Form };
        if (out.form) formsRead.add(out.form);
        return out;
      }
      if (call.name === PUBLISH_TOOL) {
        const parsed = publishSchema.safeParse(call.input);
        if (!parsed.success) return { error: "post must be a non-empty string, event_ids an array of ids, and form one of the forms." };
        if (!isForm(parsed.data.form)) return { error: `"${parsed.data.form}" is not a form. Use a name from the genre → form table.` };
        const form = parsed.data.form;
        if (!formsRead.has(form)) {
          return { error: `Read the form "${form}" with ${READ_FORM_TOOL} before handing in, and write inside it.` };
        }
        const known = new Set(c.timeline.map((e) => e.id));
        const eventIds = parsed.data.event_ids.filter((id) => known.has(id));
        const expected = expectedForm(c, eventIds);
        if (expected && expected !== form) {
          return {
            error: `The form of this post is "${expected}", not "${form}": ${
              c.lockedForm ? "it is already set." : c.posts.length === 0 ? "the first post of a subject is the origin." : "it follows from the genre of the event you chose."
            } Read it with ${READ_FORM_TOOL} and write inside it.`,
          };
        }
        handed = { text: parsed.data.post, eventIds, form };
        return { ok: true };
      }
      return runWriterTool(c, call);
    },
  });

  const final = handed as { text: string; eventIds: string[]; form: Form } | null;
  return {
    // Sans publish_post accepté, on garde la réponse finale pour que le banc montre ce qui s'est
    // passé — mais `handed` à faux dit à l'appelant que ce n'est PAS un post.
    text: final?.text ?? result.reply,
    eventIds: final?.eventIds ?? [],
    form: final?.form ?? null,
    handed: final !== null,
    turns: result.turns,
    toolCalls: result.toolCalls,
    stoppedAtMaxTurns: result.stoppedAtMaxTurns,
  };
}

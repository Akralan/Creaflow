import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callAgentic } from "./provider";
import { SCRIPT_CORE_PROMPT, buildRecentPostsBlock, type ContentType, type Platform } from "./prompts";
import { platformRuleText } from "./platformRules";
import { buildStyleBlock, type StyleProfile } from "./styleProfile";
import type { RecentPostCard } from "./recentPosts";
import type { Reader } from "./readerPortrait";
import type { SeriesForm } from "./seriesForm";
import { storyboardStepSchema, type GeneratedScript } from "./scriptSchema";
import { checkGeneratedPost, type CheckContext } from "./scriptChecks";
import { splitDocumentIntoParts } from "./eventReader";
import { buildFormatBlock, enforceStoryboardCount, type VisualFormatSpec } from "@/lib/visualDesign/visualFormat";

/**
 * Le rédacteur par événements (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5) : un agent qui reçoit UN
 * événement, UN lecteur et la forme de la série, peut relire le document source et la ligne de
 * temps, écrit un brouillon, le juge comme le lecteur, recommence, puis soumet. Les contrôles du
 * code tournent dans l'outil de soumission : un post refusé revient au modèle avec ses fautes.
 */

export interface BriefEvent {
  id: string;
  date: string | null;
  datePrecision: "day" | "month" | "unknown";
  title: string;
  whatHappened: string;
  whatChanged: string | null;
  kind: string;
}

export interface EventBrief {
  event: BriefEvent;
  /** Les deux événements précédents et le suivant dans la ligne de temps, pour situer. */
  before: BriefEvent[];
  after: BriefEvent[];
  reader: Reader;
  form: SeriesForm;
  seriesLabel: string;
  /** Le document d'où vient l'événement, en entier — null pour un événement écrit à la main. */
  source: { id: string; title: string | null; text: string } | null;
  /** La ligne de temps du sujet (titres et dates), pour read_timeline. */
  timeline: BriefEvent[];
}

export interface EventWriterContext {
  brandName: string;
  activityType: string;
  subjectName: string;
  platform: Platform;
  contentType: ContentType;
  visual?: VisualFormatSpec | null;
  styleProfile?: StyleProfile | null;
  recentPosts?: RecentPostCard[];
  brief: EventBrief;
}

const READ_SOURCE_TOOL = "read_source";
const READ_TIMELINE_TOOL = "read_timeline";
const REVIEW_DRAFT_TOOL = "review_draft";
const SUBMIT_POST_TOOL = "submit_post";

/** Au plus deux soumissions : la seconde a lu le rapport des contrôles. */
const MAX_SUBMISSIONS = 2;
const MAX_DRAFTS = 3;

function formatEventDate(e: BriefEvent): string {
  if (!e.date || e.datePrecision === "unknown") return "date inconnue";
  const d = new Date(`${e.date}T00:00:00.000Z`);
  if (e.datePrecision === "month") return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function eventLine(e: BriefEvent): string {
  return `${formatEventDate(e)} — ${e.title}`;
}

const METHOD_PROMPT = `<methode>
Tu racontes UN événement à UNE personne. Tout le reste est au service de ça.
1. Relis la source avec ${READ_SOURCE_TOOL} : le document d'où vient l'événement, en entier. C'est là que sont les détails vrais (les mots exacts, les chiffres, ce qui s'est passé juste avant et juste après). Si tu as besoin de situer l'événement dans l'histoire, ${READ_TIMELINE_TOOL}.
2. Écris un brouillon complet, pour cette seule personne, à partir de ce seul événement, dans la forme de la série.
3. Soumets-le à ${REVIEW_DRAFT_TOOL} avec ton verdict honnête, formulé comme le lecteur le dirait : est-ce qu'il lit la deuxième phrase ? est-ce qu'il arrive au bout ? est-ce qu'il apprend quelque chose qu'il ne savait pas ? est-ce qu'on dirait l'auteur, ou un service marketing ? Si le verdict est mauvais, dis en une ligne ce qui cloche et recommence à l'étape 2. Trois brouillons au plus.
4. Quand un brouillon tient, ${SUBMIT_POST_TOOL}. Si les contrôles le refusent, corrige exactement ce qui est signalé et resoumets.
</methode>

<ce_qui_fait_un_post>
- Il commence dans l'événement, pas avant : pas de contexte, pas d'annonce, pas « dans cette série ». La première phrase est déjà dedans.
- Il raconte ce qui s'est passé, puis ce que ça a changé. Avec les détails de la source : les mots exacts des gens, les chiffres, la date si elle compte.
- Il n'explique pas le produit. Si le lecteur comprend ce que fait le produit, c'est parce qu'il a vu ce qui s'est passé, pas parce qu'on le lui a décrit.
- Il se termine quand l'histoire est finie. Pas de morale, pas de liste de fonctionnalités, pas de « dans le prochain épisode », pas d'appel à l'action sauf si la forme de la série en demande un.
- Il est écrit pour UNE personne, avec ses mots, à sa longueur. Ce qu'elle ne comprend pas n'y est pas, ou est expliqué par son effet.
</ce_qui_fait_un_post>`;

export const EVENT_WRITER_SYSTEM_PROMPT = `${SCRIPT_CORE_PROMPT}\n\n${METHOD_PROMPT}`;

function tag(name: string, lines: string[]): string {
  return `<${name}>\n${lines.join("\n")}\n</${name}>`;
}

export function buildEventWriterUserMessage(context: EventWriterContext): string {
  const { brief } = context;
  const r = brief.reader;
  const f = brief.form;
  const sections: string[] = [];

  sections.push(
    tag("evenement", [
      `Série : ${brief.seriesLabel} — ${context.subjectName}, par ${context.brandName} (${context.activityType}).`,
      `L'événement à raconter : ${eventLine(brief.event)}`,
      `Ce qui s'est passé : ${brief.event.whatHappened}`,
      brief.event.whatChanged ? `Ce que ça a changé : ${brief.event.whatChanged}` : "Ce que ça a changé : rien de noté.",
      brief.before.length ? `Juste avant, dans l'histoire :\n${brief.before.map((e) => `- ${eventLine(e)}`).join("\n")}` : "C'est le premier événement de l'histoire.",
      brief.after.length ? `Juste après :\n${brief.after.map((e) => `- ${eventLine(e)}`).join("\n")}` : "Rien d'enregistré après, pour l'instant.",
      brief.source
        ? `Source : « ${brief.source.title ?? "document"} », à relire avec ${READ_SOURCE_TOOL}.`
        : "Pas de document source : l'auteur a écrit cet événement lui-même. Tu n'as que ce qui est ci-dessus.",
    ])
  );

  sections.push(
    tag("lecteur", [
      `${r.label} : ${r.who}`,
      r.knows ? `Sait déjà : ${r.knows}` : null,
      r.wants ? `Vient chercher : ${r.wants}` : null,
      r.stopsFor ? `S'arrête pour : ${r.stopsFor}` : null,
      r.turnsOff ? `Fuit : ${r.turnsOff}` : null,
      r.words.length ? `Ses mots : ${r.words.join(", ")}` : null,
    ].filter((l): l is string => l !== null))
  );

  sections.push(
    tag("forme", [
      `Ce qu'il vient chercher dans cette série : ${f.wants}`,
      `Un bon épisode pour lui : ${f.episodeShape}`,
      `Ce qui le fait partir : ${f.avoid}`,
      `Longueur et registre : ${f.register}`,
      f.words.length ? `Ses mots : ${f.words.join(", ")}` : null,
      f.jargon.length ? `À éviter, ou à expliquer par l'effet : ${f.jargon.join(", ")}` : null,
    ].filter((l): l is string => l !== null))
  );

  const styleLines = buildStyleBlock(context.styleProfile, context.platform).split("\n").slice(1).filter(Boolean);
  if (styleLines.length) sections.push(tag("style", styleLines));

  const recent = buildRecentPostsBlock(context.recentPosts);
  if (recent) sections.push(recent);

  const visualOnly = context.contentType === "visual" && context.visual?.withText === false;
  sections.push(tag("plateforme", [platformRuleText(context.platform, { visualOnly })]));
  if (context.contentType === "visual") {
    const formatBlock = buildFormatBlock(context.visual);
    if (formatBlock) sections.push(formatBlock);
  }

  sections.push(`Commence par ${READ_SOURCE_TOOL}.`);
  return sections.join("\n\n");
}

const POST_FIELDS = {
  concept: { type: "string", description: "En une phrase : ce que le lecteur doit retenir de cet événement." },
  title: { type: "string", description: "Le nom de l'idée, court, impossible à réutiliser pour un autre post." },
  caption: { type: "string", description: "Le texte du post, en entier, dans la forme de la série et la longueur de la plateforme." },
  hashtags: { type: "array", items: { type: "string" }, description: "Dans le nombre donné par <plateforme>. Vide si elle n'en utilise pas." },
  usedExcerpts: {
    type: "array",
    items: { type: "string" },
    description: "Les passages de la source copiés MOT POUR MOT qui fondent les faits du post, un par fait. Tableau vide si l'événement n'a pas de source.",
  },
  promisesMade: { type: "array", items: { type: "string" }, description: "Les promesses explicites faites au lecteur dans le post, copiées telles quelles. Vide sinon." },
};

function buildTools(context: EventWriterContext, parts: number): LlmToolDefinition[] {
  const submitProperties =
    context.contentType === "visual"
      ? {
          ...POST_FIELDS,
          hookVisual: { type: "string", description: "La composition visuelle qui arrête le lecteur (image unique ou première slide)." },
          storyboard: {
            type: "array",
            description: "Les slides, numérotées, dans le nombre donné par <format>.",
            items: {
              type: "object",
              properties: { planNumber: { type: "integer" }, description: { type: "string", description: "Ce qu'on voit et le texte affiché." } },
              required: ["planNumber", "description"],
            },
          },
        }
      : { ...POST_FIELDS, hookText: { type: "string", description: "La première phrase du post, telle quelle : elle est déjà dans l'événement." } };
  const submitRequired =
    context.contentType === "visual"
      ? ["concept", "title", "hookVisual", "storyboard", "caption", "hashtags", "usedExcerpts", "promisesMade"]
      : ["concept", "title", "hookText", "caption", "hashtags", "usedExcerpts", "promisesMade"];

  return [
    {
      name: READ_SOURCE_TOOL,
      description: context.brief.source
        ? `Le document source de l'événement, en ${parts} partie${parts > 1 ? "s" : ""}. Lis au moins la partie qui contient l'événement ; tout le document si tu as besoin du contexte.`
        : "Aucune source : cet événement a été écrit à la main par l'auteur.",
      input_schema: { type: "object", properties: { part: { type: "integer", description: "Numéro de la partie, à partir de 1." } }, required: ["part"] },
    },
    {
      name: READ_TIMELINE_TOOL,
      description: "La ligne de temps du sujet : tous ses événements datés, dans l'ordre. Pour situer, jamais pour raconter deux événements.",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    {
      name: REVIEW_DRAFT_TOOL,
      description: "Soumets un brouillon complet à ta propre relecture, comme le lecteur. Garde une trace honnête : un brouillon jugé bon sera soumis, un brouillon jugé faible sera refait.",
      input_schema: {
        type: "object",
        properties: {
          draft: { type: "string", description: "Le brouillon complet du texte du post." },
          readerVerdict: { type: "string", description: "Ce que le lecteur dirait en le lisant, en deux ou trois phrases, dans ses mots." },
          keep: { type: "boolean", description: "Vrai si ce brouillon tient et peut être soumis." },
          why: { type: "string", description: "Si keep est faux : ce qui cloche, en une ligne, et ce que tu changes." },
        },
        required: ["draft", "readerVerdict", "keep", "why"],
      },
    },
    {
      name: SUBMIT_POST_TOOL,
      description: "Soumet le post final. Les contrôles du code le vérifient : s'il est refusé, le rapport te revient et tu corriges.",
      input_schema: { type: "object", properties: submitProperties, required: submitRequired },
    },
  ];
}

const submittedTextSchema = z.object({
  concept: z.string().min(1),
  title: z.string().min(1),
  hookText: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  usedExcerpts: z.array(z.string()).default([]),
  promisesMade: z.array(z.string()).default([]),
});

const submittedVisualSchema = z.object({
  concept: z.string().min(1),
  title: z.string().min(1),
  hookVisual: z.string().min(1),
  storyboard: z.array(storyboardStepSchema).min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).min(1),
  usedExcerpts: z.array(z.string()).default([]),
  promisesMade: z.array(z.string()).default([]),
});

export interface EventWriterTrace {
  version: 4;
  event: { id: string; title: string; date: string | null };
  /** Même forme que la trace V3 pour la mémoire des derniers posts (recentPosts.ts lit trace.reader.label). */
  reader: { label: string };
  drafts: Array<{ draft: string; readerVerdict: string; keep: boolean; why: string }>;
  sourcePartsRead: number[];
  timelineRead: boolean;
  submissions: number;
  checks: { failures: string[]; retried: boolean };
  turns: number;
  stoppedAtMaxTurns: boolean;
}

interface Submission {
  script: GeneratedScript;
  failures: string[];
}

export async function writeScriptFromEvent(context: EventWriterContext): Promise<GeneratedScript> {
  const { brief } = context;
  const parts = brief.source ? splitDocumentIntoParts(brief.source.text) : [];
  const partsRead = new Set<number>();
  let timelineRead = false;
  const drafts: EventWriterTrace["drafts"] = [];
  const submissions: Submission[] = [];

  const checkContext: CheckContext = {
    platform: context.platform,
    contentType: context.contentType,
    visual: context.visual,
    materialTexts: brief.source ? [brief.source.text] : [],
    avoid: context.styleProfile?.avoid ?? [],
    recentPosts: context.recentPosts,
  };

  const parseSubmission = (input: unknown): GeneratedScript =>
    context.contentType === "visual"
      ? { contentType: "visual", ...submittedVisualSchema.parse(input) }
      : { contentType: "text", ...submittedTextSchema.parse(input) };

  const result = await callAgentic({
    system: EVENT_WRITER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildEventWriterUserMessage(context) }],
    tools: buildTools(context, parts.length),
    maxTokens: 4096,
    maxTurns: 14,
    effort: "medium",
    onToolCall: async ({ name, input }) => {
      if (name === READ_SOURCE_TOOL) {
        if (!brief.source) return { text: "", note: "Aucune source : écris à partir de l'événement tel qu'il t'est donné." };
        const { part } = input as { part?: number };
        const index = Number(part);
        if (!Number.isInteger(index) || index < 1 || index > parts.length) {
          throw new Error(`Partie ${part} inexistante : le document a ${parts.length} partie(s).`);
        }
        partsRead.add(index);
        return { title: brief.source.title, part: index, parts: parts.length, text: parts[index - 1] };
      }
      if (name === READ_TIMELINE_TOOL) {
        timelineRead = true;
        return { events: brief.timeline.map((e) => ({ date: e.date, title: e.title, current: e.id === brief.event.id })) };
      }
      if (name === REVIEW_DRAFT_TOOL) {
        const d = z
          .object({ draft: z.string(), readerVerdict: z.string(), keep: z.boolean(), why: z.string().default("") })
          .parse(input);
        drafts.push(d);
        if (d.keep) return { note: `Brouillon ${drafts.length} retenu. Soumets-le avec ${SUBMIT_POST_TOOL}.` };
        if (drafts.length >= MAX_DRAFTS) return { note: `Trois brouillons : soumets le meilleur avec ${SUBMIT_POST_TOOL}, en corrigeant ce que tu as relevé.` };
        return { note: `Brouillon ${drafts.length} écarté. Récris-le en corrigeant : ${d.why || "ce que ton verdict relève"}.` };
      }
      if (name === SUBMIT_POST_TOOL) {
        let script: GeneratedScript;
        try {
          script = parseSubmission(input);
        } catch (err) {
          const issues = err instanceof z.ZodError ? err.issues.map((i) => i.path.join(".") || "racine").join(", ") : String(err);
          throw new Error(`Post refusé, format incomplet (${issues}) : renvoie tous les champs requis.`);
        }
        if (script.contentType === "visual") {
          script = { ...script, storyboard: enforceStoryboardCount(script.storyboard, context.visual).storyboard };
        }
        const failures = checkGeneratedPost(script, null, checkContext);
        submissions.push({ script, failures });
        if (failures.length > 0 && submissions.length < MAX_SUBMISSIONS) {
          throw new Error(`Post refusé par les contrôles :\n${failures.map((f) => `- ${f}`).join("\n")}\nCorrige exactement ces points et resoumets le post complet.`);
        }
        return { accepted: true, note: failures.length ? "Accepté malgré des réserves : réponds en une phrase." : "Accepté. Réponds en une phrase." };
      }
      throw new Error(`Outil inconnu : ${name}`);
    },
  });

  if (submissions.length === 0) {
    throw new Error("Le rédacteur n'a soumis aucun post.");
  }
  // La meilleure soumission : la moins fautive ; à égalité, la dernière, qui a lu le rapport.
  const best = submissions.reduce((b, s) => (s.failures.length <= b.failures.length ? s : b), submissions[0]);
  const trace: EventWriterTrace = {
    version: 4,
    event: { id: brief.event.id, title: brief.event.title, date: brief.event.date },
    reader: { label: brief.reader.label },
    drafts,
    sourcePartsRead: [...partsRead].sort((a, b) => a - b),
    timelineRead,
    submissions: submissions.length,
    checks: { failures: best.failures, retried: submissions.length > 1 },
    turns: result.turns,
    stoppedAtMaxTurns: result.stoppedAtMaxTurns,
  };
  // La trace V4 n'a pas la forme de la V3 : elle est rangée telle quelle sur scripts.generationTrace.
  return { ...best.script, trace: trace as unknown as GeneratedScript["trace"] };
}

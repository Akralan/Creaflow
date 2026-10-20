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
import { reviewFailures, reviewForReader } from "./readerReview";
import { splitDocumentIntoParts } from "./eventReader";
import { buildFormatBlock, enforceStoryboardCount, type VisualFormatSpec } from "@/lib/visualDesign/visualFormat";
import { buildLanguageBlock, type PostLanguage } from "@/lib/language";

/**
 * The per-event writer (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5): an agent that receives ONE
 * event, ONE reader and the series form, can reread the source document and the timeline, writes a
 * draft, judges it as the reader would, starts again, then submits. The code checks run inside the
 * submission tool: a rejected post goes back to the model with its faults.
 */

export interface BriefEvent {
  id: string;
  date: string | null;
  datePrecision: "day" | "month" | "unknown";
  title: string;
  whatHappened: string;
  whatChanged: string | null;
  /** Ce que ça a coûté, ce qui était en jeu : c'est là qu'est l'histoire. */
  atStake?: string | null;
  kind: string;
  /** Ce que ce fait change pour le lecteur de CETTE série, dans ses mots
   *  (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §6). Null quand le lecteur n'a pas d'angle dessus. */
  angle?: string | null;
}

export interface EventBrief {
  event: BriefEvent;
  /** The two previous events and the next one in the timeline, to situate. */
  before: BriefEvent[];
  after: BriefEvent[];
  reader: Reader;
  form: SeriesForm;
  seriesLabel: string;
  /** The document the event comes from, in full — null for a hand-written event. */
  source: { id: string; title: string | null; text: string } | null;
  /** The subject's timeline (titles and dates), for read_timeline. */
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
  /** The language of the post: the profile's, else the notes' (src/lib/language.ts). */
  language?: PostLanguage;
}

export const READ_SOURCE_TOOL = "read_source";
export const READ_TIMELINE_TOOL = "read_timeline";
export const REVIEW_DRAFT_TOOL = "review_draft";
export const SUBMIT_POST_TOOL = "submit_post";

/** Trois et non deux depuis que le relecteur (prompt 29) rend plusieurs reproches d'un coup :
 *  une seule correction ne suffisait plus, et le post était perdu. */
export const MAX_SUBMISSIONS = 3;
export const MAX_DRAFTS = 3;

function formatEventDate(e: BriefEvent): string {
  if (!e.date || e.datePrecision === "unknown") return "unknown date";
  const d = new Date(`${e.date}T00:00:00.000Z`);
  if (e.datePrecision === "month") return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Ce que le lecteur verra : le texte publié, jamais le titre interne ni les champs de travail. */
export function postTextOf(script: GeneratedScript): string {
  const slides = "storyboard" in script && Array.isArray(script.storyboard) ? script.storyboard.map((s) => s.description) : [];
  const hook = "hookText" in script ? script.hookText : "hookVisual" in script ? script.hookVisual : null;
  return [hook, ...slides, script.caption].filter(Boolean).join("\n\n");
}


/** L'étiquette du post dans l'app. Déduite, plus demandée au modèle : un champ de plus à remplir,
 *  c'est une case de formulaire de plus, et un formulaire appelle une liste. */
export function titleFrom(hook: string, caption: string): string {
  const source = (hook || caption).trim().split("\n")[0] ?? "";
  const cut = source.length > 70 ? `${source.slice(0, 69).trimEnd().replace(/[,;:–—-]+$/, "")}…` : source;
  return cut || "(sans titre)";
}
export function eventLine(e: BriefEvent): string {
  return `${formatEventDate(e)} — ${e.title}`;
}

const METHOD_PROMPT = `<method>
You tell ONE event to ONE person. Everything else serves that.
1. Reread the source with ${READ_SOURCE_TOOL}: the document the event comes from, in full. That's where the true details are (the exact words, the numbers, what happened just before and just after). If you need to place the event in the story, ${READ_TIMELINE_TOOL}.
2. Write a complete draft, for this one person, from this one event, in the series form.
3. Submit it to ${REVIEW_DRAFT_TOOL} with your honest verdict, phrased the way the reader would say it: do they read the second sentence? do they make it to the end? do they learn something they didn't know? does it sound like the author, or like a marketing department? If the verdict is bad, say in one line what's wrong and start again at step 2. Three drafts at most.
4. When a draft holds, ${SUBMIT_POST_TOOL}. If the checks reject it, fix exactly what is flagged and resubmit.
</method>

<what_makes_a_post>
- It starts inside the event: no announcement, no "in this series". The first sentence is already in it, and it only has one job: make the reader read the second. By the end of the second sentence the reader knows who, what, and what is at stake, in a few words, never a paragraph of context.
- It tells ONE turning point, with something at stake. If nothing is at stake, there is no post.
- It tells what happened, then what it changed. With the details from the source: people's exact words, the numbers, the date if it matters.
- It uses only details found in the source. A precise detail that is true builds trust, a false one destroys it. If the source doesn't have it, leave it out.
- A win is stated plainly, or a problem is told plainly.
- A feeling is shown through a fact.
- Sentence lengths vary. A regular rhythm reads as machine-written.
- It doesn't explain the product. If the reader understands what the product does, it's because they saw what happened, not because it was described to them.
- It ends on the last thing that happened, or on one concrete fact that is still true: a number, an action taken, a sentence someone said. Then it stops. If the facts alone don't say why it mattered, one sentence is allowed: what the author thinks or feels now, never a lesson for everyone. No call to action unless the series form asks for one.
- It tells THIS event and stops before the next one. The events before and after only serve to situate in half a sentence ("a week after the demo"), without their numbers or details: they had or will have their own post.
- It doesn't look like the previous post. Look at <recent_posts>: if the last one opened with a number, this one opens differently; if it ended on "the next step", this one ends on something else, or stops dead. The series form says what an episode contains, not in what order.
- Hashtags, if any, change with the post: the event's, not the project's.
- It is written for ONE person, in their words, at their length. What they wouldn't understand isn't in it, or is explained through its effect.
- The author speaks in the first person singular. "We" only if the brief or the source says there is a team, and to refer to that team.
- Everything is written in the language given in <language>.
</what_makes_a_post>

<examples_of_form>
Three short posts, from trades that have nothing to do with the author's. Read them for ONE thing: in each, someone risked or lost something, and paid for it. 14 bowls thrown away. A survey that lied about 22 frames. A winter of rain in a hive. That is what makes them worth reading — not their rhythm, not their openings, which belong to them and not to you.

"It's not the glaze, it's the oven," the man at the supplier's said, and hung up. I had thrown away 14 bowls that month. Same recipe, same clay, one oven door I never closed the same way twice. I taped a line on the floor where the door stops. Next firing, 12 out of 12 came out. I trust the door more than the recipe now.

Day 212. The hull had 31 rotten frames, not the 9 the survey promised. I sat in the cockpit for an hour with the invoice. Then I called the yard and asked for oak. They had enough for 20. I ordered it anyway and slept in the van.

The first frame came out of the hive black. Not dark, black. Rain had been getting in all winter. Marc, forty years of bees, picked it up, smelled it, said nothing. I asked what he'd do. "Start over," he said, "and fix the roof first." We did both on Saturday.
</examples_of_form>`;

export const EVENT_WRITER_SYSTEM_PROMPT = `${SCRIPT_CORE_PROMPT}\n\n${METHOD_PROMPT}`;

export function tag(name: string, lines: string[]): string {
  return `<${name}>\n${lines.join("\n")}\n</${name}>`;
}

export function buildEventWriterUserMessage(context: EventWriterContext): string {
  const { brief } = context;
  const sections: string[] = [];

  sections.push(
    tag("event", [
      `Series: ${brief.seriesLabel} — ${context.subjectName}, by ${context.brandName} (${context.activityType}).`,
      `The event to tell: ${eventLine(brief.event)}`,
      `What happened: ${brief.event.whatHappened}`,
      brief.event.whatChanged ? `What it changed: ${brief.event.whatChanged}` : "What it changed: nothing noted.",
      // L'angle écrit pendant la lecture de la matière : le rédacteur part de là et prouve avec les
      // faits, au lieu de deviner la traduction (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §6).
      brief.event.angle ? `For this reader: ${brief.event.angle}` : null,
      brief.event.atStake ? `What it cost: ${brief.event.atStake}` : null,
      brief.before.length ? `Just before, in the story:\n${brief.before.map((e) => `- ${eventLine(e)}`).join("\n")}` : "This is the first event of the story.",
      // On ne lui montre plus ce qui vient après : le dernier bloc narratif du brief ne doit pas
      // être l'avenir, sinon le post finit dessus.
      brief.source
        ? `Source: "${brief.source.title ?? "document"}", to reread with ${READ_SOURCE_TOOL}.`
        : "No source document: the author wrote this event themselves. You only have what is above.",
    ].filter((l): l is string => l !== null))
  );

  sections.push(...buildWriterContextSections({ ...context, reader: brief.reader, form: brief.form }));

  sections.push(`Start with ${READ_SOURCE_TOOL}.`);
  return sections.join("\n\n");
}

/**
 * Everything after the brief itself, shared with the story writer (narrativeWriter.ts): who is
 * being written for, the series form, the learned style, the latest posts, the platform rules, the
 * visual format and the language. Extracted as is — same blocks, same order, same wording.
 */
export function buildWriterContextSections(context: {
  reader: Reader;
  form: SeriesForm;
  styleProfile?: StyleProfile | null;
  recentPosts?: RecentPostCard[];
  platform: Platform;
  contentType: ContentType;
  visual?: VisualFormatSpec | null;
  language?: PostLanguage;
}): string[] {
  const r = context.reader;
  const f = context.form;
  const sections: string[] = [];

  sections.push(
    tag("reader", [
      `${r.label}: ${r.who}`,
      r.knows ? `Already knows: ${r.knows}` : null,
      r.wants ? `Comes looking for: ${r.wants}` : null,
      r.stopsFor ? `Stops for: ${r.stopsFor}` : null,
      r.turnsOff ? `Turned off by: ${r.turnsOff}` : null,
      r.words.length ? `Their words: ${r.words.join(", ")}` : null,
    ].filter((l): l is string => l !== null))
  );

  sections.push(
    tag("form", [
      `What they come looking for in this series: ${f.wants}`,
      `A good episode for them: ${f.episodeShape}`,
      `What makes them leave: ${f.avoid}`,
      `Length and register: ${f.register}`,
      f.signature ? `Series signature, to work in naturally: ${f.signature}` : null,
      f.words.length ? `Their words: ${f.words.join(", ")}` : null,
      f.jargon.length ? `To avoid, or to explain through the effect: ${f.jargon.join(", ")}` : null,
    ].filter((l): l is string => l !== null))
  );

  const styleLines = buildStyleBlock(context.styleProfile, context.platform).split("\n").slice(1).filter(Boolean);
  if (styleLines.length) sections.push(tag("style", styleLines));

  const recent = buildRecentPostsBlock(context.recentPosts);
  if (recent) sections.push(recent);

  const visualOnly = context.contentType === "visual" && context.visual?.withText === false;
  sections.push(tag("platform", [platformRuleText(context.platform, { visualOnly })]));
  if (context.contentType === "visual") {
    const formatBlock = buildFormatBlock(context.visual);
    if (formatBlock) sections.push(formatBlock);
  }

  if (context.language) sections.push(buildLanguageBlock(context.language));

  return sections;
}

export const POST_FIELDS = {
  concept: { type: "string", description: "Optional, one sentence: what the reader should remember. Leave it out if the post says it already." },
  caption: { type: "string", description: "The post text, in full, in the series form and the platform's length." },
  hashtags: { type: "array", items: { type: "string" }, description: "In the number given by <platform>. Empty if it doesn't use any." },
  promisesMade: { type: "array", items: { type: "string" }, description: "Optional. Only if the author genuinely commits to a future fact in this post. Almost always absent." },
};

function buildTools(context: EventWriterContext, parts: number): LlmToolDefinition[] {
  const submitProperties =
    context.contentType === "visual"
      ? {
          ...POST_FIELDS,
          hookVisual: { type: "string", description: "The visual composition that stops the reader (single image or first slide)." },
          storyboard: {
            type: "array",
            description: "The slides, numbered, in the number given by <format>.",
            items: {
              type: "object",
              properties: { planNumber: { type: "integer" }, description: { type: "string", description: "What is seen and the text displayed." } },
              required: ["planNumber", "description"],
            },
          },
        }
      : { ...POST_FIELDS, hookText: { type: "string", description: "The first sentence of the post, as is: it is already inside the event." } };
  const submitRequired =
    context.contentType === "visual"
      ? ["hookVisual", "storyboard", "caption", "hashtags"]
      : ["hookText", "caption", "hashtags"];

  return [
    {
      name: READ_SOURCE_TOOL,
      description: context.brief.source
        ? `The event's source document, in ${parts} part${parts > 1 ? "s" : ""}. Read at least the part that contains the event; the whole document if you need the context.`
        : "No source: this event was written by hand by the author.",
      input_schema: { type: "object", properties: { part: { type: "integer", description: "Number of the part, starting at 1." } }, required: ["part"] },
    },
    {
      name: READ_TIMELINE_TOOL,
      description: "The subject's timeline: all its dated events, in order. To situate, never to tell two events.",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    {
      name: REVIEW_DRAFT_TOOL,
      description: "Submit a complete draft to your own review, as the reader. Keep an honest record: a draft judged good will be submitted, a draft judged weak will be redone.",
      input_schema: {
        type: "object",
        properties: {
          draft: { type: "string", description: "The complete draft of the post text." },
          readerVerdict: { type: "string", description: "What the reader would say while reading it, in two or three sentences, in their words." },
          unknownToReader: {
            type: "array",
            items: { type: "string" },
            description:
              "Words in this draft that this reader would not use themselves. Noting them helps you spot what to explain; leave it empty if you see none.",
          },
          keep: { type: "boolean", description: "True if this draft holds and can be submitted." },
          why: { type: "string", description: "Always: what you change if keep is false, or why it holds if keep is true. One line." },
        },
        required: ["draft", "readerVerdict", "keep", "why"],
      },
    },
    {
      name: SUBMIT_POST_TOOL,
      description: "Submits the final post. The code checks verify it: if it is rejected, the report comes back to you and you fix it.",
      input_schema: { type: "object", properties: submitProperties, required: submitRequired },
    },
  ];
}

export const submittedTextSchema = z.object({
  concept: z.string().default(""),
  title: z.string().default(""),
  hookText: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  usedExcerpts: z.array(z.string()).default([]),
  promisesMade: z.array(z.string()).default([]),
});

export const submittedVisualSchema = z.object({
  concept: z.string().default(""),
  title: z.string().default(""),
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
  /** Same shape as the V3 trace for the latest-posts memory (recentPosts.ts reads trace.reader.label). */
  reader: { label: string };
  drafts: Array<{ draft: string; readerVerdict: string; unknownToReader: string[]; keep: boolean; why: string }>;
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
    // Les mots que ce lecteur ne comprend pas : la forme de série les portait sans que rien ne les
    // vérifie (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §6).
    jargon: context.brief.form.jargon,
    recentPosts: context.recentPosts,
    language: context.language,
  };

  const parseSubmission = (input: unknown): GeneratedScript => {
    const parsed =
        context.contentType === "visual"
          ? { contentType: "visual" as const, ...submittedVisualSchema.parse(input) }
      : { contentType: "text" as const, ...submittedTextSchema.parse(input) };
    // L'étiquette du calendrier se déduit du post : un champ de moins à remplir pour le modèle.
    const hook = "hookText" in parsed ? parsed.hookText : "hookVisual" in parsed ? parsed.hookVisual : "";
    return { ...parsed, title: parsed.title || titleFrom(hook, parsed.caption) };
  };

  const result = await callAgentic({
    system: EVENT_WRITER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildEventWriterUserMessage(context) }],
    tools: buildTools(context, parts.length),
    maxTokens: 4096,
    maxTurns: 14,
    effort: "medium",
    onToolCall: async ({ name, input }) => {
      if (name === READ_SOURCE_TOOL) {
        if (!brief.source) return { text: "", note: "No source: write from the event as it is given to you." };
        const { part } = input as { part?: number };
        const index = Number(part);
        if (!Number.isInteger(index) || index < 1 || index > parts.length) {
          throw new Error(`Part ${part} does not exist: the document has ${parts.length} part(s).`);
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
          .object({ draft: z.string(), readerVerdict: z.string(), unknownToReader: z.array(z.string()).default([]), keep: z.boolean(), why: z.string().default("") })
          .parse(input);
        drafts.push(d);
        if (d.keep) return { note: `Draft ${drafts.length} kept. Submit it with ${SUBMIT_POST_TOOL}.` };
        if (drafts.length >= MAX_DRAFTS) return { note: `Three drafts: submit the best one with ${SUBMIT_POST_TOOL}, fixing what you noted.` };
        return { note: `Draft ${drafts.length} discarded. Rewrite it, fixing: ${d.why || "what your verdict points out"}.` };
      }
      if (name === SUBMIT_POST_TOOL) {
        let script: GeneratedScript;
        try {
          script = parseSubmission(input);
        } catch (err) {
          const issues = err instanceof z.ZodError ? err.issues.map((i) => i.path.join(".") || "root").join(", ") : String(err);
          throw new Error(`Post rejected, incomplete format (${issues}): return all the required fields.`);
        }
        if (script.contentType === "visual") {
          script = { ...script, storyboard: enforceStoryboardCount(script.storyboard, context.visual).storyboard };
        }
        // Les contrôles du code, puis le relecteur (prompt 29) : un appel SÉPARÉ qui ne voit que
        // le lecteur et le texte, jamais la matière. Seulement à la première soumission — la
        // par se perdre (essayé le 2026-10-20). Le rédacteur garde ensuite ses essais pour corriger.
        const codeFailures = checkGeneratedPost(script, null, checkContext);
        const readerFailures =
          codeFailures.length === 0 && submissions.length === 0
            ? reviewFailures(await reviewForReader({ reader: context.brief.reader, postText: postTextOf(script) }))
            : [];
        const failures = [...codeFailures, ...readerFailures];
        submissions.push({ script, failures });
        if (failures.length > 0 && submissions.length < MAX_SUBMISSIONS) {
          throw new Error(`Post rejected by the checks:\n${failures.map((f) => `- ${f}`).join("\n")}\nFix exactly these points and resubmit the complete post.`);
        }
        return { accepted: true, note: failures.length ? "Accepted despite reservations: reply in one sentence." : "Accepted. Reply in one sentence." };
      }
      throw new Error(`Unknown tool: ${name}`);
    },
  });

  if (submissions.length === 0) {
    // Dire POURQUOI : sans ça, la panne est muette et on ne peut que deviner (vécu le 2026-10-20).
    throw new Error(
      `The writer submitted no post after ${result.turns} turn(s)` +
        `${result.stoppedAtMaxTurns ? " (turn cap reached)" : ""}, ${drafts.length} draft(s). Its last words: ${result.reply.slice(0, 300)}`
    );
  }
  // The best submission: the least faulty; on a tie, the last one, which read the report.
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
  // The V4 trace doesn't have the V3 shape: it is stored as is on scripts.generationTrace.
  return { ...best.script, trace: trace as unknown as GeneratedScript["trace"] };
}

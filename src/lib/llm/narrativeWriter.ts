import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callAgentic } from "./provider";
import { SCRIPT_CORE_PROMPT, type ContentType, type Platform } from "./prompts";
import type { StyleProfile } from "./styleProfile";
import type { RecentPostCard } from "./recentPosts";
import type { Reader } from "./readerPortrait";
import type { SeriesForm } from "./seriesForm";
import type { GeneratedScript } from "./scriptSchema";
import { checkGeneratedPost, type CheckContext } from "./scriptChecks";
import { splitDocumentIntoParts } from "./eventReader";
import {
  buildWriterContextSections,
  eventLine,
  MAX_DRAFTS,
  MAX_SUBMISSIONS,
  POST_FIELDS,
  READ_SOURCE_TOOL,
  READ_TIMELINE_TOOL,
  REVIEW_DRAFT_TOOL,
  SUBMIT_POST_TOOL,
  submittedTextSchema,
  submittedVisualSchema,
  tag,
  type BriefEvent,
} from "./eventWriter";
import { enforceStoryboardCount, type VisualFormatSpec } from "@/lib/visualDesign/visualFormat";
import type { PostLanguage } from "@/lib/language";
import type { NarrativeKind } from "@/lib/narrative/placement";

/**
 * Prompt 28 — the story writer (docs/SPEC_FIL_NARRATIF.md §10).
 *
 * Same skeleton as the per-event writer: an agent that rereads its material, drafts, judges itself
 * as the reader, starts again, then submits through the code checks. Two differences, both
 * deliberate. It is given a SCOPE — the exact list of events it may read — and nothing outside it
 * exists for it. And its `<what_makes_a_post>` block depends on the type of story post: the four
 * blocks below are the only thing that separates an origin from a checkpoint.
 *
 * It never chooses its type or its scope: the code hands them over (placement.ts).
 */

export interface NarrativeBrief {
  kind: NarrativeKind;
  /** The scope: the only events this post may read. */
  scope: BriefEvent[];
  subject: { name: string; description: string | null; problem: string | null; valueProposition: string | null };
  /** Promise kept only: the sentence to quote and the post that made it. */
  promise: { text: string; postText: string } | null;
  reader: Reader;
  form: SeriesForm;
  seriesLabel: string;
  /** The source documents of the scope's events, in full. */
  sources: Array<{ id: string; title: string | null; text: string }>;
}

export interface NarrativeWriterContext {
  brandName: string;
  activityType: string;
  subjectName: string;
  platform: Platform;
  contentType: ContentType;
  visual?: VisualFormatSpec | null;
  styleProfile?: StyleProfile | null;
  recentPosts?: RecentPostCard[];
  brief: NarrativeBrief;
  language?: PostLanguage;
}

const READ_POST_TOOL = "read_post";

const METHOD_PROMPT = `<method>
You write ONE post for ONE person, from the events you are given and nothing else.
1. Reread the material with ${READ_SOURCE_TOOL}: the documents those events come from, in full. That's where the true details are. ${READ_TIMELINE_TOOL} shows you your scope again, never more than it.
2. Write a complete draft, for this one person, in the series form.
3. Submit it to ${REVIEW_DRAFT_TOOL} with your honest verdict, phrased the way the reader would say it: do they read the second sentence? do they make it to the end? does it sound like the author, or like a marketing department? If the verdict is bad, say in one line what's wrong and start again at step 2. Three drafts at most.
4. When a draft holds, ${SUBMIT_POST_TOOL}. If the checks reject it, fix exactly what is flagged and resubmit.
</method>`;

/** What every story post obeys, whatever its type (§10). */
const COMMON_RULES = `<rules>
- Never name what kind of post this is. The words "checkpoint", "recap", "milestone", "vision", "origin story", "promise", "update" and their equivalents in any language do not appear, and neither does "in this series".
- Only the events in your scope exist. No figure, no fact, no date that is not in them.
- No call to action.
- The author speaks in the first person singular. "We" only if the material says there is a team.
- Sentence lengths vary. A regular rhythm reads as machine-written.
- It ends on a fact, like an episode does: something that happened, or something that is still true. Then it stops.
- It doesn't look like the previous posts. Look at <recent_posts>: a different opening, a different ending.
- Everything is written in the language given in <language>.
</rules>`;

const WHAT_MAKES_A_POST: Record<NarrativeKind, string> = {
  origin: `<what_makes_a_post>
- It tells the problem, long before any solution. What was seen, heard or lived that could not stay as it was.
- It starts in the moment it happened: a place, a person, a sentence someone said. Not "it all started when I realised that…".
- The reader must be able to recognise that moment in the material: it is one real event, with its details, not a summary of a year.
- What the author is building is named in the LAST sentence, or not at all. Never before.
- No feature is described. No benefit is promised. The reader should finish it understanding what hurt, not what the product does.
- It does not say the project will fix it. It says why it could not be left alone.
</what_makes_a_post>`,
  vision: `<what_makes_a_post>
- It says where this is going and for whom, and every claim about the future rests on a decision that was actually taken.
- It starts from one of those decisions, told concretely: what was chosen, and what was given up to choose it. What is given up is what makes a vision credible.
- No roadmap, no dates, no numbers promised. "Next quarter", "by summer", "10,000 users" do not appear.
- It does not list what the product will do. It says what the author refuses to build, and what that leaves.
- It is written for the person in <reader>, not for investors.
</what_makes_a_post>`,
  checkpoint: `<what_makes_a_post>
- It says what has CHANGED between the first event of the scope and the last. One movement, not a list.
- It never retells an episode. Each of these events already had its own post: naming one again in detail is the one thing this post must not do.
- One or two facts carry the whole change — the ones that would not have been true at the start. The rest is left out.
- It does not reuse the figures of the neighbouring posts. If a number appears, it is one that only makes sense across the whole stretch.
- A stretch made of hard decisions and failures is worth as much as one made of wins. Tell it the same way, plainly.
- No "in the last few weeks I…" inventory. It starts on what is different now.
</what_makes_a_post>`,
  promise: `<what_makes_a_post>
- Two beats: what the author said they would do, then what happened. Nothing else.
- The promise is quoted EXACTLY as it was written, word for word, from <promise>. It is not rephrased, not shortened, not tidied up.
- Then the event that answers it, told with its facts.
- No judgement, no apology, no victory lap. The author does not say whether they kept their word: the reader sees it.
- If the event only partly answers the promise, say what happened and stop. Do not stretch it to fit.
- It does not promise anything new at the end.
</what_makes_a_post>`,
};

export const NARRATIVE_WRITER_SYSTEM_PROMPTS: Record<NarrativeKind, string> = {
  origin: `${SCRIPT_CORE_PROMPT}\n\n${METHOD_PROMPT}\n\n${WHAT_MAKES_A_POST.origin}\n\n${COMMON_RULES}`,
  vision: `${SCRIPT_CORE_PROMPT}\n\n${METHOD_PROMPT}\n\n${WHAT_MAKES_A_POST.vision}\n\n${COMMON_RULES}`,
  checkpoint: `${SCRIPT_CORE_PROMPT}\n\n${METHOD_PROMPT}\n\n${WHAT_MAKES_A_POST.checkpoint}\n\n${COMMON_RULES}`,
  promise: `${SCRIPT_CORE_PROMPT}\n\n${METHOD_PROMPT}\n\n${WHAT_MAKES_A_POST.promise}\n\n${COMMON_RULES}`,
};

/** What the subject is allowed to say, per type: the origin gets the problem, the vision gets all three. */
function subjectLines(brief: NarrativeBrief): string[] {
  const s = brief.subject;
  if (brief.kind === "origin") return s.problem ? [`The problem this exists for: ${s.problem}`] : [];
  if (brief.kind !== "vision") return [];
  return [
    s.description ? `What is being built: ${s.description}` : null,
    s.problem ? `The problem it solves: ${s.problem}` : null,
    s.valueProposition ? `What it brings: ${s.valueProposition}` : null,
  ].filter((l): l is string => l !== null);
}

export function buildNarrativeWriterUserMessage(context: NarrativeWriterContext): string {
  const { brief } = context;
  const sections: string[] = [];

  sections.push(
    tag("scope", [
      `Series: ${brief.seriesLabel} — ${context.subjectName}, by ${context.brandName} (${context.activityType}).`,
      "These events, and only these, are what you may tell:",
      ...brief.scope.map((e) => `- ${eventLine(e)}\n  What happened: ${e.whatHappened}${e.whatChanged ? `\n  What it changed: ${e.whatChanged}` : ""}`),
      ...subjectLines(brief),
      brief.sources.length
        ? `Sources to reread with ${READ_SOURCE_TOOL}: ${brief.sources.map((s, i) => `${i + 1}. "${s.title ?? "document"}"`).join(", ")}.`
        : "No source document: you only have what is above.",
    ])
  );

  if (brief.promise) {
    sections.push(tag("promise", [`The sentence to quote word for word:`, brief.promise.text, "", "The post that made it:", brief.promise.postText]));
  }

  sections.push(...buildWriterContextSections({ ...context, reader: brief.reader, form: brief.form }));
  sections.push(brief.sources.length ? `Start with ${READ_SOURCE_TOOL}.` : `Start by writing a draft.`);
  return sections.join("\n\n");
}

function buildTools(context: NarrativeWriterContext, parts: number): LlmToolDefinition[] {
  const { brief } = context;
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
      : { ...POST_FIELDS, hookText: { type: "string", description: "The first sentence of the post, as is." } };
  const submitRequired =
    context.contentType === "visual"
      ? ["concept", "title", "hookVisual", "storyboard", "caption", "hashtags", "usedExcerpts", "promisesMade"]
      : ["concept", "title", "hookText", "caption", "hashtags", "usedExcerpts", "promisesMade"];

  return [
    {
      name: READ_SOURCE_TOOL,
      description: parts > 0 ? `The material behind your scope, in ${parts} part${parts > 1 ? "s" : ""}.` : "No source document for these events.",
      input_schema: { type: "object", properties: { part: { type: "integer", description: "Number of the part, starting at 1." } }, required: ["part"] },
    },
    {
      name: READ_TIMELINE_TOOL,
      description: "Your scope, listed again. It is the whole timeline you are allowed to see.",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    ...(brief.promise
      ? [
          {
            name: READ_POST_TOOL,
            description: "The published post that made the promise, in full. To quote its sentence exactly.",
            input_schema: { type: "object", properties: {}, required: [] },
          },
        ]
      : []),
    {
      name: REVIEW_DRAFT_TOOL,
      description: "Submit a complete draft to your own review, as the reader. A draft judged good will be submitted, a draft judged weak will be redone.",
      input_schema: {
        type: "object",
        properties: {
          draft: { type: "string", description: "The complete draft of the post text." },
          readerVerdict: { type: "string", description: "What the reader would say while reading it, in two or three sentences, in their words." },
          keep: { type: "boolean", description: "True if this draft holds and can be submitted." },
          why: { type: "string", description: "If keep is false: what's wrong, in one line, and what you change." },
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

export interface NarrativeWriterTrace {
  version: 1;
  narrativeKind: NarrativeKind;
  scope: Array<{ id: string; title: string }>;
  reader: { label: string };
  drafts: Array<{ draft: string; readerVerdict: string; keep: boolean; why: string }>;
  sourcePartsRead: number[];
  submissions: number;
  checks: { failures: string[]; retried: boolean };
  turns: number;
  stoppedAtMaxTurns: boolean;
}

export async function writeNarrativePost(context: NarrativeWriterContext): Promise<GeneratedScript> {
  const { brief } = context;
  // The scope's documents, end to end, cut the same way as for an episode.
  const parts = brief.sources.flatMap((s) => splitDocumentIntoParts(s.text));
  const partsRead = new Set<number>();
  const drafts: NarrativeWriterTrace["drafts"] = [];
  const submissions: Array<{ script: GeneratedScript; failures: string[] }> = [];

  const checkContext: CheckContext = {
    platform: context.platform,
    contentType: context.contentType,
    visual: context.visual,
    // The promise post quotes its own earlier post: that post is material too.
    materialTexts: [...brief.sources.map((s) => s.text), ...(brief.promise ? [brief.promise.postText] : [])],
    avoid: context.styleProfile?.avoid ?? [],
    recentPosts: context.recentPosts,
    language: context.language,
  };

  const parseSubmission = (input: unknown): GeneratedScript =>
    context.contentType === "visual"
      ? { contentType: "visual", ...submittedVisualSchema.parse(input) }
      : { contentType: "text", ...submittedTextSchema.parse(input) };

  const result = await callAgentic({
    system: NARRATIVE_WRITER_SYSTEM_PROMPTS[brief.kind],
    messages: [{ role: "user", content: buildNarrativeWriterUserMessage(context) }],
    tools: buildTools(context, parts.length),
    maxTokens: 4096,
    maxTurns: 14,
    effort: "medium",
    onToolCall: async ({ name, input }) => {
      if (name === READ_SOURCE_TOOL) {
        if (parts.length === 0) return { text: "", note: "No source: write from the events as they are given to you." };
        const { part } = input as { part?: number };
        const index = Number(part);
        if (!Number.isInteger(index) || index < 1 || index > parts.length) {
          throw new Error(`Part ${part} does not exist: the material has ${parts.length} part(s).`);
        }
        partsRead.add(index);
        return { part: index, parts: parts.length, text: parts[index - 1] };
      }
      if (name === READ_TIMELINE_TOOL) {
        // The scope, never the subject's whole timeline: outside it, nothing exists for this post.
        return { events: brief.scope.map((e) => ({ id: e.id, date: e.date, title: e.title })) };
      }
      if (name === READ_POST_TOOL) {
        if (!brief.promise) throw new Error("There is no earlier post to read for this one.");
        return { promise: brief.promise.text, post: brief.promise.postText };
      }
      if (name === REVIEW_DRAFT_TOOL) {
        const d = z.object({ draft: z.string(), readerVerdict: z.string(), keep: z.boolean(), why: z.string().default("") }).parse(input);
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
        const failures = checkGeneratedPost(script, null, checkContext);
        submissions.push({ script, failures });
        if (failures.length > 0 && submissions.length < MAX_SUBMISSIONS) {
          throw new Error(`Post rejected by the checks:\n${failures.map((f) => `- ${f}`).join("\n")}\nFix exactly these points and resubmit the complete post.`);
        }
        return { accepted: true, note: failures.length ? "Accepted despite reservations: reply in one sentence." : "Accepted. Reply in one sentence." };
      }
      throw new Error(`Unknown tool: ${name}`);
    },
  });

  if (submissions.length === 0) throw new Error("The writer submitted no post.");

  const best = submissions.reduce((b, s) => (s.failures.length <= b.failures.length ? s : b), submissions[0]);
  const trace: NarrativeWriterTrace = {
    version: 1,
    narrativeKind: brief.kind,
    scope: brief.scope.map((e) => ({ id: e.id, title: e.title })),
    reader: { label: brief.reader.label },
    drafts,
    sourcePartsRead: [...partsRead].sort((a, b) => a - b),
    submissions: submissions.length,
    checks: { failures: best.failures, retried: submissions.length > 1 },
    turns: result.turns,
    stoppedAtMaxTurns: result.stoppedAtMaxTurns,
  };
  return { ...best.script, trace: trace as unknown as GeneratedScript["trace"] };
}

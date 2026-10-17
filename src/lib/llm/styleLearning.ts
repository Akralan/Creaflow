import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { MAX_STYLE_LIST_ITEMS, MAX_STYLE_RULES, styleProfileSchema, styleRuleSchema, type StyleProfile } from "./styleProfile";

/**
 * Style learning pass (docs/SPEC_APPRENTISSAGE_STYLE.md §5). This whole file is pure logic except
 * `learnStyle`, which makes the only LLM call; the corpus selection in the database lives in
 * styleLearningService.ts.
 */

/** A script's text columns as stored (and as frozen in firstDraftSnapshot). */
export interface ScriptTextColumns {
  title?: string | null;
  hookVisual?: string | null;
  hookText?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  storyboard?: { planNumber: number; description: string }[] | null;
}

export interface FieldDiff {
  field: string;
  before: string;
  after: string;
}

export interface StyleCorrection {
  platform: string;
  contentType: string;
  diffs: FieldDiff[];
}

export interface StyleSample {
  platform: string;
  contentType: string;
  /** The author's text, already assembled (title + hook + body). */
  text: string;
}

export const MAX_CORRECTIONS_PER_PASS = 15;
export const MAX_SAMPLES_PER_PASS = 5;
const TRUNCATE_HEAD = 800;
const TRUNCATE_TAIL = 400;

/** Truncates in the middle (start + end) to keep the opening and the call to action, the two most corrected areas. */
export function truncateMiddle(text: string, head = TRUNCATE_HEAD, tail = TRUNCATE_TAIL): string {
  if (text.length <= head + tail) return text;
  return `${text.slice(0, head)} […] ${text.slice(text.length - tail)}`;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function textFieldsOf(columns: ScriptTextColumns): Record<string, string> {
  const fields: Record<string, string> = {
    title: normalize(columns.title),
    hookVisual: normalize(columns.hookVisual),
    hookText: normalize(columns.hookText),
    caption: normalize(columns.caption),
    hashtags: (columns.hashtags ?? []).join(" ").trim(),
  };
  for (const step of columns.storyboard ?? []) {
    fields[`storyboard.${step.planNumber}`] = normalize(step.description);
  }
  return fields;
}

/**
 * Block-by-block gaps between the first draft and the final version. Empty if the script is identical
 * to its first draft (it teaches nothing). Both sides are truncated.
 */
export function diffScript(firstDraft: ScriptTextColumns, final: ScriptTextColumns): FieldDiff[] {
  const before = textFieldsOf(firstDraft);
  const after = textFieldsOf(final);
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: FieldDiff[] = [];
  for (const field of fields) {
    const b = before[field] ?? "";
    const a = after[field] ?? "";
    if (b === a) continue;
    diffs.push({ field, before: truncateMiddle(b), after: truncateMiddle(a) });
  }
  return diffs;
}

// --- Statistics computed in TypeScript, never by the model (§2 "the model doesn't count") ---

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

export function countEmojis(text: string): number {
  return (text.match(EMOJI_RE) ?? []).length;
}

export function countExclamations(text: string): number {
  return (text.match(/!/g) ?? []).length;
}

export function opensWithQuestion(text: string): boolean {
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? "";
  return firstSentence.trim().endsWith("?");
}

export function countHashtags(text: string): number {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export interface EditStats {
  corrections: number;
  emojisRemovedIn: number;
  emojisAddedIn: number;
  hookShortenedIn: number;
  hookLengthenedIn: number;
  /** Median of the hook's relative length delta, as a percentage (negative = shortened). */
  hookMedianDeltaPct: number | null;
  openingQuestionRemovedIn: number;
  openingQuestionAddedIn: number;
  exclamationsReducedIn: number;
  exclamationsIncreasedIn: number;
  hashtagsAvgBefore: number | null;
  hashtagsAvgAfter: number | null;
  captionMedianDeltaPct: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function deltaPct(before: string, after: string): number | null {
  if (before.length === 0) return null;
  return Math.round(((after.length - before.length) / before.length) * 100);
}

/** A script's "hook": hookText (text) otherwise hookVisual (visual). */
function hookDiff(diffs: FieldDiff[]): FieldDiff | undefined {
  return diffs.find((d) => d.field === "hookText") ?? diffs.find((d) => d.field === "hookVisual");
}

export function computeEditStats(corrections: StyleCorrection[]): EditStats {
  const stats: EditStats = {
    corrections: corrections.length,
    emojisRemovedIn: 0,
    emojisAddedIn: 0,
    hookShortenedIn: 0,
    hookLengthenedIn: 0,
    hookMedianDeltaPct: null,
    openingQuestionRemovedIn: 0,
    openingQuestionAddedIn: 0,
    exclamationsReducedIn: 0,
    exclamationsIncreasedIn: 0,
    hashtagsAvgBefore: null,
    hashtagsAvgAfter: null,
    captionMedianDeltaPct: null,
  };
  const hookDeltas: number[] = [];
  const captionDeltas: number[] = [];
  const hashtagsBefore: number[] = [];
  const hashtagsAfter: number[] = [];

  for (const correction of corrections) {
    const allBefore = correction.diffs.map((d) => d.before).join("\n");
    const allAfter = correction.diffs.map((d) => d.after).join("\n");
    const emojiDelta = countEmojis(allAfter) - countEmojis(allBefore);
    if (emojiDelta < 0) stats.emojisRemovedIn += 1;
    if (emojiDelta > 0) stats.emojisAddedIn += 1;
    const exclDelta = countExclamations(allAfter) - countExclamations(allBefore);
    if (exclDelta < 0) stats.exclamationsReducedIn += 1;
    if (exclDelta > 0) stats.exclamationsIncreasedIn += 1;

    const hook = hookDiff(correction.diffs);
    if (hook) {
      const d = deltaPct(hook.before, hook.after);
      if (d !== null) {
        hookDeltas.push(d);
        if (d < 0) stats.hookShortenedIn += 1;
        if (d > 0) stats.hookLengthenedIn += 1;
      }
      const qBefore = opensWithQuestion(hook.before);
      const qAfter = opensWithQuestion(hook.after);
      if (qBefore && !qAfter) stats.openingQuestionRemovedIn += 1;
      if (!qBefore && qAfter) stats.openingQuestionAddedIn += 1;
    }

    const caption = correction.diffs.find((d) => d.field === "caption");
    if (caption) {
      const d = deltaPct(caption.before, caption.after);
      if (d !== null) captionDeltas.push(d);
      const qBefore = opensWithQuestion(caption.before);
      const qAfter = opensWithQuestion(caption.after);
      if (!hook && qBefore && !qAfter) stats.openingQuestionRemovedIn += 1;
      if (!hook && !qBefore && qAfter) stats.openingQuestionAddedIn += 1;
    }

    const hashtags = correction.diffs.find((d) => d.field === "hashtags");
    if (hashtags) {
      hashtagsBefore.push(countHashtags(hashtags.before));
      hashtagsAfter.push(countHashtags(hashtags.after));
    }
  }

  stats.hookMedianDeltaPct = median(hookDeltas);
  stats.captionMedianDeltaPct = median(captionDeltas);
  if (hashtagsBefore.length > 0) {
    stats.hashtagsAvgBefore = Math.round((hashtagsBefore.reduce((a, b) => a + b, 0) / hashtagsBefore.length) * 10) / 10;
    stats.hashtagsAvgAfter = Math.round((hashtagsAfter.reduce((a, b) => a + b, 0) / hashtagsAfter.length) * 10) / 10;
  }
  return stats;
}

export function formatEditStats(stats: EditStats): string {
  const n = stats.corrections;
  if (n === 0) return "No correction in this pass.";
  const signed = (v: number) => `${v > 0 ? "+" : ""}${v}`;
  const lines = [
    `Emojis: removed in ${stats.emojisRemovedIn}/${n}, added in ${stats.emojisAddedIn}/${n}`,
    `Exclamation marks: reduced in ${stats.exclamationsReducedIn}/${n}, increased in ${stats.exclamationsIncreasedIn}/${n}`,
  ];
  if (stats.hookMedianDeltaPct !== null) {
    lines.push(
      `Hook length: shortened in ${stats.hookShortenedIn}/${n}, lengthened in ${stats.hookLengthenedIn}/${n} (median ${signed(stats.hookMedianDeltaPct)}%)`
    );
  }
  lines.push(
    `Opening question: removed in ${stats.openingQuestionRemovedIn}/${n}, added in ${stats.openingQuestionAddedIn}/${n}`
  );
  if (stats.hashtagsAvgBefore !== null && stats.hashtagsAvgAfter !== null) {
    lines.push(`Hashtags: average ${stats.hashtagsAvgBefore} → ${stats.hashtagsAvgAfter}`);
  }
  if (stats.captionMedianDeltaPct !== null) {
    lines.push(`Caption / body length: median ${signed(stats.captionMedianDeltaPct)}%`);
  }
  return lines.join("\n");
}

// --- Prompt (Annex A of the spec) ---

export const LEARN_STYLE_TOOL_NAME = "learn_style";

export const learnStyleTool: LlmToolDefinition = {
  name: LEARN_STYLE_TOOL_NAME,
  description:
    "Updates an author's style profile from their corrections to generated texts and from texts they wrote themselves. All text in English.",
  input_schema: {
    type: "object",
    properties: {
      tone: { type: "string", description: "General tone (e.g. humorous, direct, warm)." },
      sentenceLength: { type: "string", description: "Typical sentence length and structure." },
      emojiUsage: { type: "string", description: "Emoji usage (frequency, type)." },
      vocabulary: { type: "string", description: "Vocabulary register used." },
      summary: {
        type: "string",
        description: "2-3 sentence summary of the author's voice, directly injectable as a style instruction.",
      },
      rules: {
        type: "array",
        description:
          "Imperative, short, verifiable rules, drawn from what the author SYSTEMATICALLY corrects (at least two concordant corrections, or a clear statistic). Keep the existing rules unless contradicted. Merge duplicates. 12 maximum. platform non-null only if the rule applies to one platform alone.",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            platform: { type: ["string", "null"] },
          },
          required: ["text", "platform"],
          additionalProperties: false,
        },
      },
      avoid: {
        type: "array",
        description: "Words, expressions or tics the author removes or never uses. Empty array if nothing clear.",
        items: { type: "string" },
      },
      prefer: {
        type: "array",
        description: "Expressions or phrasings the author adds or uses on their own. Empty array if nothing clear.",
        items: { type: "string" },
      },
      changeNotes: {
        type: "string",
        description:
          "2 to 4 sentences for the author: what changes compared to the previous profile and why (which corrections motivated it).",
      },
    },
    required: ["tone", "sentenceLength", "emojiUsage", "vocabulary", "summary", "rules", "avoid", "prefer", "changeNotes"],
    additionalProperties: false,
  },
};

export const LEARN_STYLE_SYSTEM_PROMPT = `You are an author's editor-in-chief. You receive their current style profile, then texts generated by a machine along with the version the author finally kept (BEFORE / AFTER), texts they wrote themselves, and statistics computed on these gaps.
Your task: update their style profile so that future generations need fewer corrections.
Rules:
- Retain only the FORM (tone, length, structure, vocabulary, punctuation, emojis, hashtags, calls to action). Ignore content corrections (numbers, facts, product details).
- A rule exists only if at least two corrections support it, or if a statistic shows it as systematic.
- A rule is an imperative, concrete sentence, verifiable on reading ("The hook fits in one sentence", not "Be punchy").
- Keep the existing rules unless the new corrections contradict them. Merge duplicates. Never more than ${MAX_STYLE_RULES}.
- If a rule clearly applies to one platform only, fill platform with the platform's key; otherwise null.
- Texts written by the author themselves are the reference for their voice: they feed summary, avoid and prefer.
- All profile fields are mandatory: if there isn't enough material for a descriptor, reuse the current profile's value or cautiously describe what you observe.
- Write all fields in English.`;

export function buildLearnStyleUserMessage(params: {
  currentProfile: StyleProfile | null;
  corrections: StyleCorrection[];
  samples: StyleSample[];
  stats: EditStats;
}): string {
  const sections: string[] = [];
  sections.push(
    `=== CURRENT PROFILE ===\n${params.currentProfile ? JSON.stringify(params.currentProfile, null, 2) : "none (first analysis)"}`
  );
  sections.push(`=== STATISTICS ON ${params.corrections.length} CORRECTIONS ===\n${formatEditStats(params.stats)}`);
  if (params.corrections.length > 0) {
    const blocks = params.corrections.map((c, i) => {
      const lines = c.diffs.map((d) => `[${d.field}]\nBEFORE: ${d.before}\nAFTER: ${d.after}`);
      return `--- Script ${i + 1} · ${c.platform} · ${c.contentType} ---\n${lines.join("\n")}`;
    });
    sections.push(`=== CORRECTIONS ===\n${blocks.join("\n\n")}`);
  }
  if (params.samples.length > 0) {
    const blocks = params.samples.map((s) => `--- ${s.platform} · ${s.contentType} ---\n${truncateMiddle(s.text)}`);
    sections.push(`=== TEXTS WRITTEN BY THE AUTHOR ===\n${blocks.join("\n\n")}`);
  }
  return sections.join("\n\n");
}

export const learnStyleResultSchema = z.object({
  tone: z.string().min(1),
  sentenceLength: z.string().min(1),
  emojiUsage: z.string().min(1),
  vocabulary: z.string().min(1),
  summary: z.string().min(1),
  rules: z.array(styleRuleSchema).max(MAX_STYLE_RULES),
  avoid: z.array(z.string().trim().min(1)).max(MAX_STYLE_LIST_ITEMS),
  prefer: z.array(z.string().trim().min(1)).max(MAX_STYLE_LIST_ITEMS),
  changeNotes: z.string().min(1),
});

export interface LearnStyleResult {
  styleProfile: StyleProfile;
  changeNotes: string;
}

export async function learnStyle(params: {
  currentProfile: StyleProfile | null;
  corrections: StyleCorrection[];
  samples: StyleSample[];
  scriptCount: number;
  now?: Date;
}): Promise<LearnStyleResult> {
  const stats = computeEditStats(params.corrections);
  const args = await callStructured({
    system: LEARN_STYLE_SYSTEM_PROMPT,
    userMessage: buildLearnStyleUserMessage({ ...params, stats }),
    tool: learnStyleTool,
    maxTokens: 2048,
  });
  const { changeNotes, ...profileFields } = learnStyleResultSchema.parse(args);
  const styleProfile = styleProfileSchema.parse({
    ...profileFields,
    evidence: { scriptCount: params.scriptCount, learnedAt: (params.now ?? new Date()).toISOString() },
  });
  return { styleProfile, changeNotes };
}

import { platformLimits, VISUAL_ONLY_CAPTION_MAX } from "./platformRules";
import type { GenerationPrep } from "./scriptSchema";
import { hookOpening, type RecentPostCard } from "./recentPosts";
import { enforceStoryboardCount, type VisualFormatSpec } from "@/lib/visualDesign/visualFormat";
import { languageFailure, type PostLanguage } from "@/lib/language";
// Pure module (no database): same fuzzy matching as citation recording, so a passage judged
// missing here is also missing there.
import { findBestMatchInText } from "@/lib/services/citationMatching";

/**
 * Code checks on a generated post (docs/SPEC_PROMPT_GENERATION_V3.md §5): what the model declares
 * in selfCheck is not enough, we verify. Each failure is a sentence addressed to the model
 * (Annex A.9), reused as is in the second-attempt message.
 */

export interface CheckablePost {
  title: string;
  hookText?: string;
  hookVisual?: string;
  storyboard?: { planNumber: number; description: string }[];
  caption: string;
  hashtags: string[];
  usedExcerpts: string[];
  /** Sentences where the author commits to a future fact (docs/SPEC_FIL_NARRATIF.md §8), copied as they appear. */
  promisesMade: string[];
}

export interface CheckContext {
  platform: string;
  contentType: "visual" | "text";
  visual?: VisualFormatSpec | null;
  /** Annotated text of the documents given to the model (the used-passage markers are stripped here). */
  materialTexts: string[];
  /** "Avoid" list learned from the author's style. */
  avoid: string[];
  /** Words this series' reader does not understand (`form.jargon`, docs/SPEC_EVENEMENTS_PAR_CIBLE.md
   *  §6). Collected since the series form existed and, until now, never enforced: that is how a post
   *  about a JSONB column reached a physiotherapist. */
  jargon?: string[];
  /** Cards of the subject's latest posts, newest first (docs/SPEC_MEMOIRE_ET_VEILLE.md §2). */
  recentPosts?: RecentPostCard[];
  /** The language the post must be in (src/lib/language.ts): a rule, not a preference. */
  language?: PostLanguage;
}

/** Lowercase, accents stripped, apostrophes and whitespace unified. */
export function normalizeForCheck(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// Annex A.8: each pattern matches a rule from <writing>, on normalized text.
const BANNED_PATTERNS: Array<{ label: string; re: RegExp }> = [
  // Comma required: "it's not finished yet but it's usable" is not the targeted construction.
  { label: "it's not …, it's …", re: /\b(?:it|this|that)(?:'s| is) not [^.!?,]{1,60}, (?:it's|it is|but|this is|that's)\b/ },
  { label: "not just …, but …", re: /\bnot (?:just|only|merely|simply) [^.!?,]{1,60}, (?:but|it's|it is)\b/ },
  { label: "more than a …, a …", re: /\bmore than (?:just )?an? [^.!?]{1,60}?, an?\b/ },
  { label: "have you ever wondered", re: /\b(?:have you )?ever wondered\b/ },
  { label: "discover how/why/what", re: /\bdiscover (?:how|why|what|the)\b/ },
  { label: "don't hesitate to", re: /\b(?:do not|don't) hesitate to\b/ },
  { label: "in today's … world", re: /\bin today's [a-z-]+(?: [a-z-]+)? world\b|\bin a world where\b/ },
  { label: "ready to take … to the next level", re: /\bready to take [^.!?]{1,40} to the next level\b/ },
  { label: "excited/thrilled to announce", re: /\b(?:excited|thrilled|proud|humbled) to (?:announce|share|introduce)\b|\bi'm humbled\b/ },
  { label: "let's dive in", re: /\blet's (?:dive|delve) (?:in|into)\b/ },
  { label: "here's the thing", re: /\bhere's the thing\b/ },
  { label: "spoiler alert", re: /\bspoiler(?: alert)? ?:|\bspoiler alert\b/ },
  { label: "the result?", re: /\bthe result ?\?/ },
  { label: "game changer", re: /game[- ]?chang(?:er|ing)/ },
  { label: "revolutionary", re: /\brevolutionary\b|\bgroundbreaking\b/ },
  { label: "delve", re: /\bdelve\b/ },
];
const OPENING_QUESTION = { label: "what if…? as an opener", re: /^(?:what if|ever wondered|have you ever|did you ever|do you ever)\b/ };

// Both the English and the legacy French marker are stripped (the marker is produced by
// services/citationMatching.ts).
const USED_MARKERS = /\[already used in a previous post\]|\[\/already used\]|\[déjà utilisé dans un post précédent\]|\[\/déjà utilisé\]/g;
// Searched on normalized (lowercased) text.
const GAP_RE = /\[to be completed\]/g;
const MAX_GAPS = 2;

function postTextFields(post: CheckablePost): Array<{ field: string; text: string }> {
  return [
    { field: "the title", text: post.title },
    ...(post.hookText ? [{ field: "the hook", text: post.hookText }] : []),
    ...(post.storyboard ?? []).map((s) => ({ field: `slide ${s.planNumber}`, text: s.description })),
    { field: "the text", text: post.caption },
  ];
}

function bannedPhraseFailures(post: CheckablePost, avoid: string[]): string[] {
  const failures: string[] = [];
  for (const { field, text } of postTextFields(post)) {
    const normalized = normalizeForCheck(text);
    for (const { label, re } of BANNED_PATTERNS) {
      if (re.test(normalized)) failures.push(`Banned phrasing: "${label}" in ${field}.`);
    }
    for (const item of avoid) {
      const needle = normalizeForCheck(item);
      if (needle && normalized.includes(needle)) failures.push(`Phrasing the author bans: "${item}" in ${field}.`);
    }
  }
  const opening = normalizeForCheck(post.hookText || post.caption);
  if (OPENING_QUESTION.re.test(opening)) failures.push(`Banned phrasing: "${OPENING_QUESTION.label}".`);
  return failures;
}

/** Length of the published text: a text post's hook is its first sentence, counted if the caption doesn't already contain it. */
function publishedTextLength(post: CheckablePost): number {
  if (!post.hookText || post.caption.includes(post.hookText.trim())) return post.caption.length;
  return post.hookText.length + 1 + post.caption.length;
}

function lengthFailures(post: CheckablePost, ctx: CheckContext): string[] {
  const limits = platformLimits(ctx.platform);
  if (!limits) return [];
  const failures: string[] = [];
  if (limits.hookIsTitle) {
    if (post.title.length > limits.hookMax) {
      failures.push(`The title is ${post.title.length} characters long, ${ctx.platform} shows ${limits.hookMax} at most.`);
    }
  } else if (post.hookText && post.hookText.length > limits.hookMax) {
    failures.push(`The hook is ${post.hookText.length} characters long, ${ctx.platform} shows ${limits.hookMax} before "see more".`);
  }
  const visualOnly = ctx.contentType === "visual" && ctx.visual?.withText === false;
  const length = publishedTextLength(post);
  const [min, max] = visualOnly ? [0, VISUAL_ONLY_CAPTION_MAX] : [limits.captionMin, limits.captionMax];
  if (length < min || length > max) {
    failures.push(`The text is ${length} characters long, expected between ${min} and ${max}.`);
  }
  const tags = post.hashtags.length;
  if (tags < limits.hashtagsMin || tags > limits.hashtagsMax) {
    failures.push(`${tags} hashtags, expected between ${limits.hashtagsMin} and ${limits.hashtagsMax}.`);
  }
  return failures;
}

function citationFailures(post: CheckablePost, ctx: CheckContext): string[] {
  if (post.usedExcerpts.length === 0 || ctx.materialTexts.length === 0) return [];
  const sources = ctx.materialTexts.map((t) => t.replace(USED_MARKERS, ""));
  const found = post.usedExcerpts.some((excerpt) => sources.some((source) => findBestMatchInText(excerpt, source)));
  return found ? [] : ["None of the usedExcerpts quotes can be found in the material: quote the passages word for word."];
}

/**
 * A declared promise must really be in the post (docs/SPEC_FIL_NARRATIF.md §8): it is what a later
 * "promise kept" post will quote word for word. Same tolerance as the citations: only a post whose
 * declared promises are ALL absent is sent back, so a light rewording still passes.
 */
function promiseFailures(post: CheckablePost): string[] {
  if (post.promisesMade.length === 0) return [];
  const text = postTextFields(post)
    .map((f) => f.text)
    .join("\n");
  const found = post.promisesMade.some((promise) => findBestMatchInText(promise, text));
  return found ? [] : ["None of the declared promisesMade can be found in the post: copy the sentences as they appear."];
}

/** Au moins 25 caractères d'explication derrière le terme : une incise, pas un simple accolement. */
const MIN_EXPLANATION_CHARS = 25;

/**
 * Un mot que le lecteur de la série ne comprend pas doit être expliqué par son effet, ou absent
 * (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §6). « Expliqué » = suivi, dans la même phrase, d'une incise
 * d'au moins {@link MIN_EXPLANATION_CHARS} caractères : « rangés en JSONB, c'est-à-dire que tout un
 * mouvement tient dans une seule ligne » passe, « un payload JSONB. » non.
 */
function jargonFailures(post: CheckablePost, ctx: CheckContext): string[] {
  const terms = ctx.jargon ?? [];
  if (terms.length === 0) return [];
  const failures: string[] = [];
  for (const { text } of postTextFields(post)) {
    for (const sentence of text.split(/(?<=[.!?…])\s+/)) {
      const normalized = normalizeForCheck(sentence);
      for (const term of terms) {
        const needle = normalizeForCheck(term);
        if (!needle) continue;
        // Mot entier : « pose » ne doit pas se déclencher sur « posologue ».
        const at = normalized.search(new RegExp(`(^|[^\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u"));
        if (at === -1) continue;
        const after = normalized.slice(at + needle.length);
        if (after.trim().length < MIN_EXPLANATION_CHARS) {
          failures.push(`"${term}" is in the words this reader does not understand: say what it changes for them, or leave it out.`);
        }
      }
    }
  }
  return [...new Set(failures)];
}

function gapFailures(post: CheckablePost): string[] {
  const gaps = postTextFields(post).reduce((n, { text }) => n + (normalizeForCheck(text).match(GAP_RE) ?? []).length, 0);
  return gaps > MAX_GAPS ? [`${gaps} "[to be completed]", ${MAX_GAPS} at most.`] : [];
}

/** The post is written in the language it was asked in, title, hook, slides and text alike. */
function languageFailures(post: CheckablePost, ctx: CheckContext): string[] {
  if (!ctx.language) return [];
  const failure = languageFailure(ctx.language, postTextFields(post).map((f) => f.text));
  return failure ? [failure] : [];
}

function selfCheckFailures(prep: GenerationPrep | null): string[] {
  if (!prep) return [];
  const { selfCheck } = prep;
  const failures: string[] = [];
  if (!selfCheck.factsFromMaterial) failures.push("Your review flags a problem: a fact does not come from the supplied context.");
  if (selfCheck.bannedPhrasesFound.length > 0) {
    failures.push(`Your review flags a problem: banned phrasings found (${selfCheck.bannedPhrasesFound.join(", ")}).`);
  }
  if (normalizeForCheck(selfCheck.readerTest).replace(/[«»".]/g, "").trim() === "none") {
    failures.push("Your review flags a problem: the target reader has no reason to stop on this post.");
  }
  if (!selfCheck.authorTest) failures.push("Your review flags a problem: the post doesn't sound like the author.");
  return failures;
}

/** Repetition against the subject's latest posts (docs/SPEC_MEMOIRE_ET_VEILLE.md §2, Annex A.4). */
function repetitionFailures(post: CheckablePost, prep: GenerationPrep | null, recent: RecentPostCard[]): string[] {
  if (recent.length === 0) return [];
  const failures: string[] = [];
  const hook = post.hookText || post.storyboard?.[0]?.description || "";
  const opening = hookOpening(hook);
  const repeated = opening ? recent.find((c) => c.hook && hookOpening(c.hook) === opening) : undefined;
  if (repeated?.hook) failures.push(`The hook repeats that of a recent post ("${repeated.hook}"): find another way in.`);
  const kind = prep ? prep.hookOptions[prep.chosenHook.index]?.kind?.trim().toLowerCase() : undefined;
  const [last, beforeLast] = recent;
  if (kind && last?.hookKind === kind && beforeLast?.hookKind === kind) {
    failures.push(`The last two posts already opened with a "${kind}" type of hook: choose another type.`);
  }
  return failures;
}

/** All the §5 checks. Empty = the post passes. */
export function checkGeneratedPost(post: CheckablePost, prep: GenerationPrep | null, ctx: CheckContext): string[] {
  const storyboard =
    ctx.contentType === "visual" && post.storyboard ? enforceStoryboardCount(post.storyboard, ctx.visual) : null;
  return [
    ...languageFailures(post, ctx),
    ...bannedPhraseFailures(post, ctx.avoid),
    ...lengthFailures(post, ctx),
    ...citationFailures(post, ctx),
    ...promiseFailures(post),
    ...jargonFailures(post, ctx),
    ...gapFailures(post),
    ...repetitionFailures(post, prep, ctx.recentPosts ?? []),
    ...(storyboard?.reminder ? [storyboard.reminder] : []),
    ...selfCheckFailures(prep),
  ];
}

/** <refusal> block added to the second-attempt message (Annex A.9). */
export function buildRefusalBlock(failures: string[]): string {
  return `<refusal>\nYour previous version was rejected:\n${failures.map((f) => `- ${f}`).join("\n")}\nWrite the complete post again, fixing these points. Keep your preparation if it still holds.\n</refusal>`;
}

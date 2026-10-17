/**
 * Language of the generated posts. One rule: the language set in the profile if there is one,
 * otherwise the language of the author's notes. Pure module (no database), shared by the prompts,
 * the writer's checks and the settings screen.
 */

export const POST_LANGUAGES = [
  { code: "en", label: "English", promptName: "English" },
  { code: "fr", label: "Français", promptName: "French" },
] as const;

export type PostLanguage = (typeof POST_LANGUAGES)[number]["code"];

/** Fallback when the profile sets nothing and the notes say nothing (no material, or another language). */
export const DEFAULT_POST_LANGUAGE: PostLanguage = "en";

export function isPostLanguage(value: unknown): value is PostLanguage {
  return POST_LANGUAGES.some((l) => l.code === value);
}

export function languagePromptName(code: PostLanguage): string {
  return POST_LANGUAGES.find((l) => l.code === code)?.promptName ?? "English";
}

// Function words that belong to one language only ("a", "on", "in", "as" are in both, so left out).
const STOPWORDS: Record<PostLanguage, string[]> = {
  en: ["the", "and", "of", "was", "with", "that", "this", "for", "but", "not", "have", "my", "are", "you", "from", "it's", "i'm", "what", "when", "then", "they", "were", "had", "which"],
  fr: ["le", "la", "les", "des", "du", "de", "et", "est", "un", "une", "que", "qui", "pour", "dans", "sur", "pas", "je", "mon", "ma", "ne", "avec", "au", "aux", "ce", "cette", "il", "elle", "nous", "vous", "sont", "j'ai", "c'est", "mais", "plus", "ses", "été"],
};

/** Both languages have to be this clearly separated, and the text long enough, to call it. */
const MIN_HITS = 4;
const MIN_RATIO = 1.8;
/** Enough to tell the language of a long document without reading all of it. */
const SAMPLE_CHARS = 40_000;

function countHits(words: string[], list: Set<string>): number {
  let n = 0;
  for (const w of words) if (list.has(w)) n++;
  return n;
}

/**
 * Language of a text among the supported ones, or null when it can't be told (too short, mostly
 * code, another language). A function-word count: enough for two languages, no dependency.
 */
export function detectLanguage(text: string): PostLanguage | null {
  const words = text
    .slice(0, SAMPLE_CHARS)
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .split(/[^\p{L}']+/u)
    .filter(Boolean);
  const en = countHits(words, new Set(STOPWORDS.en));
  // Accented letters that English text almost never has: a small push towards French.
  const accents = (text.slice(0, SAMPLE_CHARS).match(/[éèêàùçôîâ]/gi) ?? []).length;
  const fr = countHits(words, new Set(STOPWORDS.fr)) + Math.min(accents / 4, words.length / 50);
  if (en + fr < MIN_HITS) return null;
  if (fr >= en * MIN_RATIO) return "fr";
  if (en >= fr * MIN_RATIO) return "en";
  return null;
}

export interface ResolvedLanguage {
  language: PostLanguage;
  source: "profile" | "notes" | "default";
}

/**
 * The language a post must be written in: the profile's, else the notes' (the language most of
 * them are in), else the default. `profileLanguage` is whatever is stored: anything unsupported
 * counts as "not set".
 */
export function resolvePostLanguage(profileLanguage: string | null | undefined, notes: string[]): ResolvedLanguage {
  if (isPostLanguage(profileLanguage)) return { language: profileLanguage, source: "profile" };
  const votes: Record<PostLanguage, number> = { en: 0, fr: 0 };
  for (const note of notes) {
    const found = detectLanguage(note);
    if (found) votes[found] += Math.min(note.length, SAMPLE_CHARS);
  }
  if (votes.en === 0 && votes.fr === 0) return { language: DEFAULT_POST_LANGUAGE, source: "default" };
  return { language: votes.fr > votes.en ? "fr" : "en", source: "notes" };
}

/**
 * The <language> block of the user messages: placed next to the writing instructions, because
 * documents and timeline in another language otherwise win over a line in the system prompt.
 */
export function buildLanguageBlock(code: PostLanguage): string {
  const name = languagePromptName(code);
  return `<language>\nWrite the whole post in ${name}: title, hook, text, slides and hashtags. The documents and the timeline may be in another language: read them as they are, but nothing of that language ends up in the post, except the exact words of a quote.\n</language>`;
}

/** Failure sentence for the checks, or null when the post is in the expected language (or can't be told). */
export function languageFailure(expected: PostLanguage, texts: string[]): string | null {
  const found = detectLanguage(texts.join("\n"));
  if (!found || found === expected) return null;
  return `The post is written in ${languagePromptName(found)}, it must be written in ${languagePromptName(expected)}: title, hook, text, slides and hashtags. Rewrite all of it in ${languagePromptName(expected)}.`;
}

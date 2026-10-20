/**
 * Rules and limits per platform (docs/SPEC_PROMPT_GENERATION_V3.md Annex A.3) — a single table,
 * read by the prompt's <platform> block AND by the code checks (scriptChecks.ts), so the
 * instruction and the verification never diverge. The numbers are starting values, to be tuned
 * with use.
 */

export interface PlatformLimits {
  /** Characters visible before "see more"; applies to the title when `hookIsTitle`. */
  hookMax: number;
  hookIsTitle: boolean;
  captionMin: number;
  captionMax: number;
  hashtagsMin: number;
  hashtagsMax: number;
}

// Pas de plancher de longueur : un post court n'est pas une faute. Le minimum de 600 sur LinkedIn
// forçait le remplissage, et le seul remplissage disponible depuis un brief est l'énumération —
// les trois posts donnés en exemple au rédacteur font 229 à 322 caractères et étaient refusés.
export const PLATFORM_LIMITS: Record<string, PlatformLimits> = {
  linkedin: { hookMax: 200, hookIsTitle: false, captionMin: 0, captionMax: 1500, hashtagsMin: 0, hashtagsMax: 3 },
  x: { hookMax: 120, hookIsTitle: false, captionMin: 0, captionMax: 280, hashtagsMin: 0, hashtagsMax: 1 },
};

/** Caption of a visual post without text (`withText: false`): the visual carries the message. */
export const VISUAL_ONLY_CAPTION_MAX = 300;

export function platformLimits(platform: string): PlatformLimits | null {
  return PLATFORM_LIMITS[platform] ?? null;
}

const PLATFORM_TEXTS: Record<string, (l: PlatformLimits) => string> = {
  linkedin: (l) =>
    `LinkedIn. Only the first two lines (about ${l.hookMax} characters) show before "see more": they must be enough to make people want to read on. ${l.captionMax} characters at most, in paragraphs of one or two sentences separated by a blank line. As short as the story needs: a post that says one thing well beats a long one. ${l.hashtagsMin} to ${l.hashtagsMax} hashtags, at the end. The register: someone sharing what they learned, not an announcement.`,
  x: (l) =>
    `X. A post is at most ${l.captionMax} characters, hook included: if the idea doesn't fit, tighten it instead of cutting it. ${l.hashtagsMin} or ${l.hashtagsMax} hashtag. Direct tone, no introductory formula.`,
};

const GENERIC_PLATFORM_TEXT = "Adapt the format and tone to the conventions of this platform, without borrowing those of another.";

/** Text of the <platform> block. A visual post without text has its caption limit replaced. */
export function platformRuleText(platform: string, options?: { visualOnly?: boolean }): string {
  const limits = platformLimits(platform);
  const text = PLATFORM_TEXTS[platform];
  if (!limits || !text) return GENERIC_PLATFORM_TEXT;
  const base = text(limits);
  return options?.visualOnly
    ? `${base} Here the visual carries everything: the caption is at most ${VISUAL_ONLY_CAPTION_MAX} characters, whatever the platform.`
    : base;
}

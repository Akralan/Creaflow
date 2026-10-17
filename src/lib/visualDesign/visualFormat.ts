import { z } from "zod";

/**
 * Format of a visual post (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §1-§2): single image, carousel
 * of N slides, or D-second animation on a single slide. A property of the script, decided at
 * generation — it constrains the number of storyboard entries.
 */
export const VISUAL_FORMATS = ["single", "carousel", "animation"] as const;
export type VisualFormat = (typeof VISUAL_FORMATS)[number];

export const MIN_SLIDES = 2;
export const MAX_SLIDES = 10;
export const DEFAULT_SLIDES = 5;
export const MIN_DURATION_MS = 5_000;
export const MAX_DURATION_MS = 15_000;
export const DEFAULT_DURATION_MS = 8_000;
/** An animation has between 3 and 6 text moments (§2). */
export const ANIMATION_MOMENTS = { min: 3, max: 6 } as const;

export interface VisualFormatSpec {
  format: VisualFormat;
  /** Carousel only. */
  slideCount: number | null;
  /** Animation only. */
  durationMs: number | null;
  /** The visual comes with a real post text (a single post: text + visual); false = the visual
   *  carries everything, the caption stays short. Absent = true, the earlier behavior. */
  withText?: boolean;
}

export const visualFormatSchema = z.enum(VISUAL_FORMATS);

/** Fields accepted by the generation routes; `normalizeVisualSpec` fills in the defaults. */
export const visualFormatFieldsSchema = z.object({
  visualFormat: visualFormatSchema.optional(),
  slideCount: z.number().int().min(MIN_SLIDES).max(MAX_SLIDES).optional(),
  durationMs: z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS).optional(),
  withText: z.boolean().optional(),
});

export function normalizeVisualSpec(input: {
  visualFormat?: VisualFormat | null;
  slideCount?: number | null;
  durationMs?: number | null;
  withText?: boolean | null;
}): VisualFormatSpec {
  const format = input.visualFormat ?? "single";
  return {
    format,
    slideCount: format === "carousel" ? (input.slideCount ?? DEFAULT_SLIDES) : null,
    durationMs: format === "animation" ? (input.durationMs ?? DEFAULT_DURATION_MS) : null,
    ...(input.withText === false ? { withText: false } : {}),
  };
}

/** Caption line of the FORMAT block: a "visual + text" post is a single post whose caption
 *  is the full text; a visual on its own has only a short caption. */
function captionLine(spec: VisualFormatSpec): string {
  return spec.withText === false
    ? "\nShort caption: one or two sentences at most, the visual carries the message."
    : "\nPost text: the caption is a real, complete, written post that the visual accompanies and illustrates.";
}

/** Read from a `scripts` row (nullable columns on scripts predating this feature). */
export function visualSpecFromScript(script: { contentType: string; visualFormat?: string | null; slideCount?: number | null; durationMs?: number | null }): VisualFormatSpec | null {
  if (script.contentType !== "visual") return null;
  const format = VISUAL_FORMATS.includes(script.visualFormat as VisualFormat) ? (script.visualFormat as VisualFormat) : "single";
  return normalizeVisualSpec({ visualFormat: format, slideCount: script.slideCount, durationMs: script.durationMs });
}

export function expectedStoryboardRange(spec: VisualFormatSpec): { min: number; max: number } {
  if (spec.format === "carousel") return { min: spec.slideCount ?? DEFAULT_SLIDES, max: spec.slideCount ?? DEFAULT_SLIDES };
  if (spec.format === "animation") return { min: ANIMATION_MOMENTS.min, max: ANIMATION_MOMENTS.max };
  return { min: 1, max: 1 };
}

/** <format> block of the generation message (Annex A.1; tagged since docs/SPEC_PROMPT_GENERATION_V3.md). */
export function buildFormatBlock(spec: VisualFormatSpec | null | undefined): string {
  if (!spec) return "";
  if (spec.format === "carousel") {
    const n = spec.slideCount ?? DEFAULT_SLIDES;
    return `<format>\nCarousel of ${n} slides: the storyboard has exactly ${n} entries, one per slide, in reading order; the first slide is the hook, the last carries the call to action.${captionLine(spec)}\n</format>`;
  }
  if (spec.format === "animation") {
    const seconds = Math.round((spec.durationMs ?? DEFAULT_DURATION_MS) / 1000);
    return `<format>\nAnimation of ${seconds} seconds: the storyboard has between ${ANIMATION_MOMENTS.min} and ${ANIMATION_MOMENTS.max} entries; each entry is a MOMENT of on-screen text, in order of appearance, over a single background image. The text of all the moments together must be readable in ${seconds} seconds (about 3 words per second): very short sentences.${captionLine(spec)}\n</format>`;
  }
  return `<format>\nSingle image: the storyboard has exactly 1 entry — what is seen and the text displayed.${captionLine(spec)}\n</format>`;
}

export interface StoryboardCheck<T> {
  ok: boolean;
  storyboard: T[];
  reminder: string | null;
}

/**
 * Checks the number of storyboard entries and brings it within bounds (§5.1): too many → truncated,
 * too few → kept as is (never a failure for that). `reminder` is used for the second call.
 */
export function enforceStoryboardCount<T>(storyboard: T[], spec: VisualFormatSpec | null | undefined): StoryboardCheck<T> {
  if (!spec) return { ok: true, storyboard, reminder: null };
  const { min, max } = expectedStoryboardRange(spec);
  if (storyboard.length >= min && storyboard.length <= max) return { ok: true, storyboard, reminder: null };
  const expected = min === max ? `exactly ${min}` : `between ${min} and ${max}`;
  const reminder = `Format reminder: the storyboard must have ${expected} entry(ies), you returned ${storyboard.length}. Start again respecting that number.`;
  return { ok: false, storyboard: storyboard.length > max ? storyboard.slice(0, max) : storyboard, reminder };
}

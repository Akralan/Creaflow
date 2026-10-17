import { z } from "zod";

/**
 * Format d'un post visuel (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §1-§2) : image unique, carrousel
 * de N slides, ou animation de D secondes sur une seule slide. Propriété du script, décidée à la
 * génération — elle contraint le nombre d'entrées du storyboard.
 */
export const VISUAL_FORMATS = ["single", "carousel", "animation"] as const;
export type VisualFormat = (typeof VISUAL_FORMATS)[number];

export const MIN_SLIDES = 2;
export const MAX_SLIDES = 10;
export const DEFAULT_SLIDES = 5;
export const MIN_DURATION_MS = 5_000;
export const MAX_DURATION_MS = 15_000;
export const DEFAULT_DURATION_MS = 8_000;
/** Une animation a entre 3 et 6 moments de texte (§2). */
export const ANIMATION_MOMENTS = { min: 3, max: 6 } as const;

export interface VisualFormatSpec {
  format: VisualFormat;
  /** Carrousel uniquement. */
  slideCount: number | null;
  /** Animation uniquement. */
  durationMs: number | null;
  /** Le visuel est accompagné d'un vrai texte de post (un seul post : texte + visuel) ; faux = le
   *  visuel porte tout, la légende reste courte. Absent = vrai, le comportement d'avant. */
  withText?: boolean;
}

export const visualFormatSchema = z.enum(VISUAL_FORMATS);

/** Champs acceptés par les routes de génération ; `normalizeVisualSpec` complète les défauts. */
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

/** Ligne du bloc FORMAT sur la légende : un post « visuel + texte » est un seul post dont la légende
 *  est le texte complet ; un visuel seul n'a qu'une légende courte. */
function captionLine(spec: VisualFormatSpec): string {
  return spec.withText === false
    ? "\nLégende courte : une ou deux phrases au plus, c'est le visuel qui porte le message."
    : "\nTexte du post : la légende est un vrai post rédigé, complet, que le visuel accompagne et illustre.";
}

/** Lecture depuis une ligne `scripts` (colonnes nullables des scripts antérieurs au chantier). */
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

/** Bloc <format> du message de génération (Annexe A.1 ; balisé depuis docs/SPEC_PROMPT_GENERATION_V3.md). */
export function buildFormatBlock(spec: VisualFormatSpec | null | undefined): string {
  if (!spec) return "";
  if (spec.format === "carousel") {
    const n = spec.slideCount ?? DEFAULT_SLIDES;
    return `<format>\nCarrousel de ${n} slides : le storyboard a exactement ${n} entrées, une par slide, dans l'ordre de lecture ; la première accroche, la dernière porte l'appel à l'action.${captionLine(spec)}\n</format>`;
  }
  if (spec.format === "animation") {
    const seconds = Math.round((spec.durationMs ?? DEFAULT_DURATION_MS) / 1000);
    return `<format>\nAnimation de ${seconds} secondes : le storyboard a entre ${ANIMATION_MOMENTS.min} et ${ANIMATION_MOMENTS.max} entrées ; chaque entrée est un MOMENT du texte à l'écran, dans l'ordre d'apparition, sur une seule image de fond. Le texte de tous les moments réunis doit se lire en ${seconds} secondes (environ 3 mots par seconde) : phrases très courtes.${captionLine(spec)}\n</format>`;
  }
  return `<format>\nImage unique : le storyboard a exactement 1 entrée — ce qu'on voit et le texte affiché.${captionLine(spec)}\n</format>`;
}

export interface StoryboardCheck<T> {
  ok: boolean;
  storyboard: T[];
  reminder: string | null;
}

/**
 * Vérifie le nombre d'entrées du storyboard et le ramène dans les bornes (§5.1) : trop → tronqué,
 * pas assez → gardé tel quel (jamais d'échec pour ça). `reminder` sert au second appel.
 */
export function enforceStoryboardCount<T>(storyboard: T[], spec: VisualFormatSpec | null | undefined): StoryboardCheck<T> {
  if (!spec) return { ok: true, storyboard, reminder: null };
  const { min, max } = expectedStoryboardRange(spec);
  if (storyboard.length >= min && storyboard.length <= max) return { ok: true, storyboard, reminder: null };
  const expected = min === max ? `exactement ${min}` : `entre ${min} et ${max}`;
  const reminder = `Rappel de format : le storyboard doit avoir ${expected} entrée(s), tu en as renvoyé ${storyboard.length}. Recommence en respectant ce nombre.`;
  return { ok: false, storyboard: storyboard.length > max ? storyboard.slice(0, max) : storyboard, reminder };
}

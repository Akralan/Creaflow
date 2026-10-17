import { z } from "zod";

/**
 * Rythme de publication d'une série (docs/SPEC_RYTHME_DES_SERIES.md §2) : ses jours, chaque semaine
 * ou une semaine sur deux. Pur et sans dépendance serveur : lu par le calendrier, le service de
 * remplissage et les écrans (sélecteur, cartes de Direction).
 */

export const RHYTHM_HORIZON_DAYS = 28;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const seriesRhythmSchema = z
  .object({
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    every: z.union([z.literal(1), z.literal(2)]).default(1),
    /** Lundi (YYYY-MM-DD) d'une semaine où la série publie — requis quand every = 2. */
    anchor: isoDate.nullable().default(null),
  })
  .transform((r) => ({ ...r, days: [...new Set(r.days)].sort((a, b) => a - b) }))
  .refine((r) => r.every === 1 || r.anchor !== null, { message: "Une semaine sur deux demande une semaine de départ." });

export type SeriesRhythm = z.infer<typeof seriesRhythmSchema>;

/** Lecture tolérante de la colonne jsonb : null si absente ou illisible (la série ne publie rien). */
export function parseStoredRhythm(value: unknown): SeriesRhythm | null {
  const parsed = seriesRhythmSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const DAY_MS = 86_400_000;

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date UTC. */
export function isoWeekday(date: Date): number {
  return date.getUTCDay() || 7;
}

/** Lundi (minuit UTC) de la semaine d'une date. */
export function mondayOf(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return new Date(day.getTime() - (isoWeekday(day) - 1) * DAY_MS);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Dates (minuit UTC) du rythme entre `from` et `to` inclus. Avec une semaine sur deux, seules les
 * semaines à un nombre pair de semaines de l'ancre publient — l'ancre peut être avant ou après.
 */
export function datesForRhythm(rhythm: SeriesRhythm, from: Date, to: Date): Date[] {
  const days = new Set(rhythm.days);
  const anchor = rhythm.every === 2 && rhythm.anchor ? mondayOf(new Date(`${rhythm.anchor}T00:00:00Z`)) : null;
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const result: Date[] = [];
  for (let t = start.getTime(); t <= to.getTime(); t += DAY_MS) {
    const date = new Date(t);
    if (!days.has(isoWeekday(date))) continue;
    if (anchor) {
      const weeks = Math.round((mondayOf(date).getTime() - anchor.getTime()) / (7 * DAY_MS));
      if (weeks % 2 !== 0) continue;
    }
    result.push(date);
  }
  return result;
}

const SHORT_DAY = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

/** « Mer. et sam. », « Jeu., une semaine sur deux » ; « Pas de rythme » si null. */
export function rhythmLabel(rhythm: SeriesRhythm | null): string {
  if (!rhythm) return "Pas de rythme";
  const names = rhythm.days.map((d) => SHORT_DAY[d - 1]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}` : names[0];
  const text = list.charAt(0).toUpperCase() + list.slice(1);
  return rhythm.every === 2 ? `${text}, une semaine sur deux` : text;
}

/**
 * Répartit des jours entre des séries rangées de la plus lourde à la plus légère : le jour n° j va
 * à la série n° j mod n ; une série restée sans jour partage le premier jour. Même règle que la
 * reprise de la migration 0042, réutilisée en fin d'onboarding (§5).
 */
export function distributeDays(days: number[], seriesCount: number): number[][] {
  const sorted = [...new Set(days)].filter((d) => d >= 1 && d <= 7);
  const fallback = sorted[0] ?? 3;
  return Array.from({ length: seriesCount }, (_, i) => {
    const mine = sorted.filter((_, j) => j % seriesCount === i);
    return mine.length > 0 ? mine.sort((a, b) => a - b) : [fallback];
  });
}

/**
 * Jours précochés pour une nouvelle série (§4) : ceux où l'auteur peut publier qu'aucune autre
 * série n'occupe ; s'ils sont tous pris, le premier d'entre eux.
 */
export function suggestDays(availableDays: number[], taken: number[]): number[] {
  const takenSet = new Set(taken);
  const free = [...new Set(availableDays)].filter((d) => !takenSet.has(d)).sort((a, b) => a - b);
  if (free.length > 0) return free;
  const first = [...availableDays].sort((a, b) => a - b)[0];
  return [first ?? 3];
}

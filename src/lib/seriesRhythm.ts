import { z } from "zod";

/**
 * Publishing rhythm of a series (docs/SPEC_RYTHME_DES_SERIES.md §2): its days, every week
 * or every other week. Pure and with no server dependency: read by the calendar, the filling service
 * and the screens (selector, Direction cards).
 */

export const RHYTHM_HORIZON_DAYS = 28;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const seriesRhythmSchema = z
  .object({
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    every: z.union([z.literal(1), z.literal(2)]).default(1),
    /** Monday (YYYY-MM-DD) of a week in which the series publishes — required when every = 2. */
    anchor: isoDate.nullable().default(null),
  })
  .transform((r) => ({ ...r, days: [...new Set(r.days)].sort((a, b) => a - b) }))
  .refine((r) => r.every === 1 || r.anchor !== null, { message: "Every other week requires a starting week." });

export type SeriesRhythm = z.infer<typeof seriesRhythmSchema>;

/** Tolerant read of the jsonb column: null if absent or unreadable (the series publishes nothing). */
export function parseStoredRhythm(value: unknown): SeriesRhythm | null {
  const parsed = seriesRhythmSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const DAY_MS = 86_400_000;

/** ISO day (1 = Monday … 7 = Sunday) of a UTC date. */
export function isoWeekday(date: Date): number {
  return date.getUTCDay() || 7;
}

/** Monday (midnight UTC) of a date's week. */
export function mondayOf(date: Date): Date {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return new Date(day.getTime() - (isoWeekday(day) - 1) * DAY_MS);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Dates (midnight UTC) of the rhythm between `from` and `to` inclusive. With every other week, only the
 * weeks an even number of weeks away from the anchor publish — the anchor may be before or after.
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

const SHORT_DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Wed and Sat", "Thu, every other week"; "No rhythm" if null. */
export function rhythmLabel(rhythm: SeriesRhythm | null): string {
  if (!rhythm) return "No rhythm";
  const names = rhythm.days.map((d) => SHORT_DAY[d - 1]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const text = list.charAt(0).toUpperCase() + list.slice(1);
  return rhythm.every === 2 ? `${text}, every other week` : text;
}

/**
 * Spreads days across series ranked from heaviest to lightest: day no. j goes
 * to series no. j mod n; a series left without a day shares the first day. Same rule as the
 * migration 0042 backfill, reused at the end of onboarding (§5).
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
 * Pre-checked days for a new series (§4): those where the author can publish that no other
 * series occupies; if they are all taken, the first of them.
 */
export function suggestDays(availableDays: number[], taken: number[]): number[] {
  const takenSet = new Set(taken);
  const free = [...new Set(availableDays)].filter((d) => !takenSet.has(d)).sort((a, b) => a - b);
  if (free.length > 0) return free;
  const first = [...availableDays].sort((a, b) => a - b)[0];
  return [first ?? 3];
}

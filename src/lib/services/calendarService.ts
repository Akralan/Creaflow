import {
  datesForRhythm,
  toIsoDate,
  type SeriesRhythm,
} from "@/lib/seriesRhythm";

/**
 * Pure calendar logic. Since docs/SPEC_RYTHME_DES_SERIES.md, slots are no longer drawn at random
 * each month according to weights: each series places them on its rhythm (planSeriesSlots),
 * and the seriesSlotSync service keeps the horizon up to date.
 */

/** Filters a list of categories/series by the targeted platform. An item whose `platforms`
 *  is empty is visible on all networks (historical, backward-compatible behavior). */
export function filterByPlatform<T extends { platforms: string[] }>(
  items: T[],
  platform: string,
): T[] {
  return items.filter(
    (item) => item.platforms.length === 0 || item.platforms.includes(platform),
  );
}

const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Publishing days in plain words, in week order: [6, 3] → "Wednesday, Saturday". */
export function publishingDaysLabel(weekdays: number[]): string {
  return [...new Set(weekdays)]
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_NAMES[d - 1])
    .join(", ");
}

export function parseMonth(month: string): {
  year: number;
  monthIndex: number;
  daysInMonth: number;
} {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // 0-based for Date
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return { year, monthIndex, daysInMonth };
}

export interface RhythmSeries {
  id: string;
  rhythm: SeriesRhythm | null;
  /** Empty = all active networks. */
  platforms: string[];
  /** Slots removed by hand (`slotKey`): never recreated. */
  skippedSlots?: string[];
}

/** Key of a slot in a series' removed list: `YYYY-MM-DD|platform`. */
export function slotKey(date: Date, platform: string): string {
  return `${toIsoDate(date)}|${platform}`;
}

export interface ExistingSlot {
  id: string;
  seriesId: string;
  platform: string;
  scheduledDate: Date;
  /** A written or published slot never moves. */
  locked: boolean;
}

/**
 * Slots of a series (§3): to create, between `from` and `to`, the (date, network) pairs of its
 * rhythm that it doesn't have yet and that the author hasn't removed; to delete, its empty slots
 * from `from` on — including beyond `to`, placed by the old monthly calendar — that no longer
 * fall on its rhythm or on an active network. A locked slot (written, published) counts as
 * present and is never deleted.
 */
export function planSeriesSlots(input: {
  series: RhythmSeries;
  activePlatforms: string[];
  existing: ExistingSlot[];
  from: Date;
  to: Date;
}): {
  toCreate: Array<{ platform: string; scheduledDate: Date }>;
  toDelete: string[];
} {
  const { series, from, to } = input;
  const platforms = input.activePlatforms.filter(
    (p) => series.platforms.length === 0 || series.platforms.includes(p),
  );
  const mine = input.existing.filter(
    (s) =>
      s.seriesId === series.id && s.scheduledDate.getTime() >= from.getTime(),
  );
  const lastExisting = Math.max(
    to.getTime(),
    ...mine.map((s) => s.scheduledDate.getTime()),
  );
  const dates = series.rhythm
    ? datesForRhythm(series.rhythm, from, new Date(lastExisting))
    : [];
  const skipped = new Set(series.skippedSlots ?? []);
  const wanted = new Set(
    dates
      .flatMap((d) => platforms.map((p) => slotKey(d, p)))
      .filter((k) => !skipped.has(k)),
  );

  const present = new Set(
    mine.map((s) => slotKey(s.scheduledDate, s.platform)),
  );
  const toDelete = mine
    .filter(
      (s) => !s.locked && !wanted.has(slotKey(s.scheduledDate, s.platform)),
    )
    .map((s) => s.id);

  const toCreate = dates
    .filter((date) => date.getTime() <= to.getTime())
    .flatMap((date) =>
      platforms
        .filter(
          (platform) =>
            wanted.has(slotKey(date, platform)) &&
            !present.has(slotKey(date, platform)),
        )
        .map((platform) => ({ platform, scheduledDate: date })),
    );
  return { toCreate, toDelete };
}

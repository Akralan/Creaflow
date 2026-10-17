import {
  datesForRhythm,
  toIsoDate,
  type SeriesRhythm,
} from "@/lib/seriesRhythm";

/**
 * Logique pure du calendrier. Depuis docs/SPEC_RYTHME_DES_SERIES.md, les créneaux ne sont plus
 * tirés au sort chaque mois selon des poids : chaque série les pose sur son rythme (planSeriesSlots),
 * et le service seriesSlotSync tient l'horizon à jour.
 */

/** Filtre une liste de catégories/séries selon la plateforme ciblée. Un élément dont `platforms`
 *  est vide est visible sur tous les réseaux (comportement historique, rétrocompatible). */
export function filterByPlatform<T extends { platforms: string[] }>(
  items: T[],
  platform: string,
): T[] {
  return items.filter(
    (item) => item.platforms.length === 0 || item.platforms.includes(platform),
  );
}

const WEEKDAY_NAMES = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

/** Jours de publication en clair, dans l'ordre de la semaine : [6, 3] → « mercredi, samedi ». */
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
  const monthIndex = Number(monthStr) - 1; // 0-based pour Date
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return { year, monthIndex, daysInMonth };
}

export interface RhythmSeries {
  id: string;
  rhythm: SeriesRhythm | null;
  /** Vide = tous les réseaux actifs. */
  platforms: string[];
  /** Créneaux retirés à la main (`slotKey`) : jamais recréés. */
  skippedSlots?: string[];
}

/** Clé d'un créneau dans la liste des retirés d'une série : `YYYY-MM-DD|plateforme`. */
export function slotKey(date: Date, platform: string): string {
  return `${toIsoDate(date)}|${platform}`;
}

export interface ExistingSlot {
  id: string;
  seriesId: string;
  platform: string;
  scheduledDate: Date;
  /** Un créneau rédigé ou publié ne bouge jamais. */
  locked: boolean;
}

/**
 * Créneaux d'une série (§3) : à créer, entre `from` et `to`, les couples (date, réseau) de son
 * rythme qu'elle n'a pas encore et que l'auteur n'a pas retirés ; à supprimer, ses créneaux vides à
 * partir de `from` — y compris au-delà de `to`, posés par l'ancien calendrier mensuel — qui ne
 * tombent plus sur son rythme ou sur un réseau actif. Un créneau verrouillé (rédigé, publié) compte
 * comme présent et n'est jamais supprimé.
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

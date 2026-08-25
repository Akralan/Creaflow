export interface CategoryWeight {
  id: string;
  weight: number; // fraction 0-1
}

/** Filtre une liste de catégories/séries selon la plateforme ciblée. Un élément dont `platforms`
 *  est vide est visible sur tous les réseaux (comportement historique, rétrocompatible). */
export function filterByPlatform<T extends { platforms: string[] }>(items: T[], platform: string): T[] {
  return items.filter((item) => item.platforms.length === 0 || item.platforms.includes(platform));
}

/** Renormalise un sous-ensemble de poids de catégorie pour qu'ils somment à 1 — nécessaire quand
 *  categoryWeightsFromCategories est appliqué après un filtrage par plateforme (les poids globaux
 *  ne somment plus à 100% sur un sous-ensemble). Sans effet si le sous-ensemble est déjà complet. */
export function renormalizeCategoryWeights(weights: CategoryWeight[]): CategoryWeight[] {
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  if (total <= 0) return weights;
  return weights.map((w) => ({ ...w, weight: w.weight / total }));
}

/** Convertit les catégories de contenu (poids 0-100) du profil en fractions utilisables par distributeCategories. */
export function categoryWeightsFromCategories(
  categories: Array<{ id: string; weight: number }>
): CategoryWeight[] {
  return categories.map((c) => ({ id: c.id, weight: c.weight / 100 }));
}

/**
 * Aiguillage matière×catégorie (docs/SPEC_MATIERE_EDITEUR.md §5.3) : quand le corpus est sec, réduit
 * à zéro le poids des catégories "gourmandes en matière" (storytelling/coulisses) et redistribue
 * proportionnellement le reste — sans jamais retoucher un calendrier déjà généré (§8.7, tranché),
 * cette fonction n'agit qu'au moment de la génération d'un nouveau mois. Si toutes les catégories
 * fournies sont gourmandes, les poids sont renvoyés inchangés — mieux vaut un calendrier normal
 * qu'un calendrier vide (rien vers quoi réorienter).
 */
export function adjustCategoryWeightsForMaterialScarcity(
  weights: CategoryWeight[],
  hungryIds: Set<string>,
  hasSufficientMaterial: boolean
): CategoryWeight[] {
  if (hasSufficientMaterial || hungryIds.size === 0) return weights;
  const allHungry = weights.every((w) => hungryIds.has(w.id));
  if (allHungry) return weights; // rien à réoriger vers : mieux vaut un calendrier normal que vide
  const zeroed = weights.map((w) => (hungryIds.has(w.id) ? { ...w, weight: 0 } : w));
  return renormalizeCategoryWeights(zeroed);
}

/** Répartit n créneaux entre catégories selon le mix fourni, en évitant les regroupements. Renvoie les id de catégorie. */
export function distributeCategories(n: number, weights: CategoryWeight[]): string[] {
  if (n <= 0 || weights.length === 0) return [];

  const counts = weights.map((w) => ({ id: w.id, count: Math.round(w.weight * n) }));
  const diff = n - counts.reduce((sum, c) => sum + c.count, 0);
  const maxIndex = counts.reduce((best, c, i) => (c.count > counts[best].count ? i : best), 0);
  counts[maxIndex] = { ...counts[maxIndex], count: counts[maxIndex].count + diff };

  const result: (string | null)[] = new Array(n).fill(null);
  for (const { id, count } of counts) {
    if (count <= 0) continue;
    const step = n / count;
    for (let i = 0; i < count; i++) {
      let pos = Math.round(i * step);
      pos = Math.min(pos, n - 1);
      while (pos < n && result[pos] !== null) pos++;
      if (pos >= n) pos = result.findIndex((r) => r === null);
      result[pos] = id;
    }
  }

  const fallbackId = weights[0].id;
  return result.map((id) => id ?? fallbackId);
}

/** Répartit n créneaux sur les jours d'un mois de façon régulière, sans doublon. */
export function distributeDays(n: number, daysInMonth: number): number[] {
  if (n <= 0) return [];

  const used = new Set<number>();
  const days: number[] = [];
  for (let i = 0; i < n; i++) {
    let day = Math.round(((i + 0.5) * daysInMonth) / n);
    day = Math.min(Math.max(day, 1), daysInMonth);
    while (used.has(day) && day < daysInMonth) day++;
    used.add(day);
    days.push(day);
  }
  return days;
}

export function parseMonth(month: string): { year: number; monthIndex: number; daysInMonth: number } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // 0-based pour Date
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return { year, monthIndex, daysInMonth };
}

export function weeksInMonth(daysInMonth: number): number {
  return daysInMonth / 7;
}

export interface SeriesWeight {
  id: string;
  weight: number; // fraction 0-1, PAS renormalisée pour sommer à 1 (contrairement à CategoryWeight)
  categoryIds: string[];
}

/** Convertit les séries (poids % absolu, pas de normalisation à 100 comme pour les catégories). */
export function seriesWeightsFromSeries(
  series: Array<{ id: string; weight: number; categoryIds: string[] }>
): SeriesWeight[] {
  return series
    .filter((s) => s.categoryIds.length > 0)
    .map((s) => ({ id: s.id, weight: s.weight / 100, categoryIds: s.categoryIds }));
}

export interface SeriesSlotAssignment {
  seriesId: string;
  categoryId: string;
}

/**
 * Décide, parmi n créneaux (indices 0..n-1), lesquels sont promus dans une série active.
 * Contrairement à distributeCategories :
 *  - ne force JAMAIS 100% de couverture (les indices non retenus sont simplement absents de la Map,
 *    l'appelant garde alors la catégorie "plate" calculée par distributeCategories) ;
 *  - ne redistribue jamais les poids à la hausse si leur somme est < 1 ;
 *  - plafonne défensivement à la baisse (scale) si leur somme dépasse 1, pour ne jamais tenter
 *    d'assigner plus de créneaux qu'il n'y en a — sans jamais forcer à combler le reste.
 */
export function distributeSeriesOverrides(n: number, seriesWeights: SeriesWeight[]): Map<number, SeriesSlotAssignment> {
  const result = new Map<number, SeriesSlotAssignment>();
  if (n <= 0 || seriesWeights.length === 0) return result;

  const totalWeight = seriesWeights.reduce((sum, s) => sum + s.weight, 0);
  const scale = totalWeight > 1 ? 1 / totalWeight : 1;

  for (const { id, weight, categoryIds } of seriesWeights) {
    const count = Math.min(Math.round(weight * scale * n), n);
    if (count <= 0) continue;

    const step = n / count;
    let categoryCursor = 0;
    for (let i = 0; i < count; i++) {
      let pos = Math.min(Math.round(i * step), n - 1);
      let attempts = 0;
      while (result.has(pos) && attempts < n) {
        pos = (pos + 1) % n;
        attempts++;
      }
      if (result.has(pos)) continue; // plus de créneau libre : on abandonne cette occurrence plutôt que d'écraser une autre série
      result.set(pos, { seriesId: id, categoryId: categoryIds[categoryCursor % categoryIds.length] });
      categoryCursor++;
    }
  }
  return result;
}

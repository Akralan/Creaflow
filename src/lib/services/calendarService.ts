import type { ContentCategory } from "@/lib/claude/prompts";
import type { CategoryLabels } from "@/lib/claude/categoryLabels";

const DEFAULT_CATEGORY_WEIGHTS: Array<[ContentCategory, number]> = [
  ["coulisses", 0.5],
  ["vente", 0.3],
  ["educatif", 0.2],
];

/** Convertit les poids (0-100) éventuellement personnalisés du profil en fractions utilisables par distributeCategories. */
export function categoryWeightsFromLabels(
  categoryLabels?: CategoryLabels | null
): Array<[ContentCategory, number]> {
  if (!categoryLabels) return DEFAULT_CATEGORY_WEIGHTS;
  return [
    ["coulisses", categoryLabels.coulisses.weight / 100],
    ["vente", categoryLabels.vente.weight / 100],
    ["educatif", categoryLabels.educatif.weight / 100],
  ];
}

/** Répartit n créneaux entre catégories selon le mix fourni (30/50/20 par défaut), en évitant les regroupements. */
export function distributeCategories(
  n: number,
  weights: Array<[ContentCategory, number]> = DEFAULT_CATEGORY_WEIGHTS
): ContentCategory[] {
  if (n <= 0) return [];

  const counts = weights.map(([category, weight]) => [category, Math.round(weight * n)] as [ContentCategory, number]);
  const diff = n - counts.reduce((sum, [, count]) => sum + count, 0);
  counts[0][1] += diff; // ajuste l'arrondi sur "coulisses", la catégorie majoritaire

  const result: (ContentCategory | null)[] = new Array(n).fill(null);
  for (const [category, count] of counts) {
    if (count <= 0) continue;
    const step = n / count;
    for (let i = 0; i < count; i++) {
      let pos = Math.round(i * step);
      pos = Math.min(pos, n - 1);
      while (pos < n && result[pos] !== null) pos++;
      if (pos >= n) pos = result.findIndex((r) => r === null);
      result[pos] = category;
    }
  }

  return result.map((category) => category ?? "coulisses");
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

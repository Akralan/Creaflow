import type { ContentCategory } from "@/lib/claude/prompts";

const CATEGORY_WEIGHTS: Array<[ContentCategory, number]> = [
  ["coulisses", 0.5],
  ["vente", 0.3],
  ["educatif", 0.2],
];

/** Répartit n créneaux entre catégories selon le mix 30/50/20, en évitant les regroupements. */
export function distributeCategories(n: number): ContentCategory[] {
  if (n <= 0) return [];

  const counts = CATEGORY_WEIGHTS.map(([category, weight]) => [category, Math.round(weight * n)] as [ContentCategory, number]);
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

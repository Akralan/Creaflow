import { describe, expect, it } from "vitest";
import {
  distributeCategories,
  distributeDays,
  parseMonth,
  weeksInMonth,
} from "./calendarService";

describe("distributeCategories", () => {
  it("renvoie un tableau vide pour n <= 0", () => {
    expect(distributeCategories(0)).toEqual([]);
    expect(distributeCategories(-3)).toEqual([]);
  });

  it("renvoie exactement n catégories, jamais null", () => {
    for (const n of [1, 2, 3, 5, 7, 10, 13, 20]) {
      const result = distributeCategories(n);
      expect(result).toHaveLength(n);
      expect(result.every((c) => c !== null && c !== undefined)).toBe(true);
    }
  });

  it("respecte approximativement le mix 30% vente / 50% coulisses / 20% éducatif sur un grand échantillon", () => {
    const n = 100;
    const result = distributeCategories(n);
    const counts = { vente: 0, coulisses: 0, educatif: 0 };
    for (const c of result) counts[c]++;

    expect(counts.coulisses).toBeGreaterThanOrEqual(45);
    expect(counts.coulisses).toBeLessThanOrEqual(55);
    expect(counts.vente).toBeGreaterThanOrEqual(25);
    expect(counts.vente).toBeLessThanOrEqual(35);
    expect(counts.educatif).toBeGreaterThanOrEqual(15);
    expect(counts.educatif).toBeLessThanOrEqual(25);
  });

  it("ne regroupe pas systématiquement une catégorie au début (répartition étalée)", () => {
    const result = distributeCategories(10);
    // Toutes les mêmes catégories d'affilée sur l'ensemble des 10 slots serait un signe
    // que l'étalement ne fonctionne pas (ex: 5x "coulisses" puis 3x "vente" puis 2x "educatif").
    const firstHalf = result.slice(0, 5);
    const uniqueInFirstHalf = new Set(firstHalf);
    expect(uniqueInFirstHalf.size).toBeGreaterThan(1);
  });
});

describe("distributeDays", () => {
  it("renvoie un tableau vide pour n <= 0", () => {
    expect(distributeDays(0, 31)).toEqual([]);
  });

  it("renvoie n jours valides (entre 1 et daysInMonth) sans doublon quand n <= daysInMonth", () => {
    const daysInMonth = 31;
    for (const n of [1, 4, 8, 13, 20, 31]) {
      const result = distributeDays(n, daysInMonth);
      expect(result).toHaveLength(n);
      expect(result.every((d) => d >= 1 && d <= daysInMonth)).toBe(true);
      expect(new Set(result).size).toBe(n);
    }
  });

  it("répartit les jours en ordre croissant sur le mois", () => {
    const result = distributeDays(4, 28);
    const sorted = [...result].sort((a, b) => a - b);
    expect(result).toEqual(sorted);
  });
});

describe("parseMonth", () => {
  it("calcule le bon nombre de jours pour un mois de 31 jours", () => {
    expect(parseMonth("2026-08")).toEqual({ year: 2026, monthIndex: 7, daysInMonth: 31 });
  });

  it("calcule le bon nombre de jours pour février hors année bissextile", () => {
    expect(parseMonth("2026-02").daysInMonth).toBe(28);
  });

  it("calcule le bon nombre de jours pour février en année bissextile", () => {
    expect(parseMonth("2024-02").daysInMonth).toBe(29);
  });
});

describe("weeksInMonth", () => {
  it("renvoie une valeur fractionnaire cohérente", () => {
    expect(weeksInMonth(28)).toBe(4);
    expect(weeksInMonth(31)).toBeCloseTo(31 / 7, 5);
  });
});

import { describe, expect, it } from "vitest";
import {
  categoryWeightsFromCategories,
  distributeCategories,
  distributeDays,
  distributeSeriesOverrides,
  filterByPlatform,
  parseMonth,
  renormalizeCategoryWeights,
  seriesWeightsFromSeries,
  weeksInMonth,
  type CategoryWeight,
  type SeriesWeight,
} from "./calendarService";

const SAMPLE_WEIGHTS: CategoryWeight[] = [
  { id: "coulisses", weight: 0.5 },
  { id: "vente", weight: 0.3 },
  { id: "educatif", weight: 0.2 },
];

describe("categoryWeightsFromCategories", () => {
  it("convertit des poids 0-100 en fractions", () => {
    expect(categoryWeightsFromCategories([{ id: "a", weight: 40 }, { id: "b", weight: 60 }])).toEqual([
      { id: "a", weight: 0.4 },
      { id: "b", weight: 0.6 },
    ]);
  });
});

describe("distributeCategories", () => {
  it("renvoie un tableau vide pour n <= 0", () => {
    expect(distributeCategories(0, SAMPLE_WEIGHTS)).toEqual([]);
    expect(distributeCategories(-3, SAMPLE_WEIGHTS)).toEqual([]);
  });

  it("renvoie un tableau vide si aucune catégorie n'est fournie", () => {
    expect(distributeCategories(5, [])).toEqual([]);
  });

  it("renvoie exactement n catégories, jamais null", () => {
    for (const n of [1, 2, 3, 5, 7, 10, 13, 20]) {
      const result = distributeCategories(n, SAMPLE_WEIGHTS);
      expect(result).toHaveLength(n);
      expect(result.every((c) => c !== null && c !== undefined)).toBe(true);
    }
  });

  it("respecte approximativement le mix de poids fourni sur un grand échantillon", () => {
    const n = 100;
    const result = distributeCategories(n, SAMPLE_WEIGHTS);
    const counts: Record<string, number> = { vente: 0, coulisses: 0, educatif: 0 };
    for (const id of result) counts[id]++;

    expect(counts.coulisses).toBeGreaterThanOrEqual(45);
    expect(counts.coulisses).toBeLessThanOrEqual(55);
    expect(counts.vente).toBeGreaterThanOrEqual(25);
    expect(counts.vente).toBeLessThanOrEqual(35);
    expect(counts.educatif).toBeGreaterThanOrEqual(15);
    expect(counts.educatif).toBeLessThanOrEqual(25);
  });

  it("fonctionne avec un nombre de catégories différent de 3 (généralisation)", () => {
    const weights: CategoryWeight[] = [
      { id: "a", weight: 0.4 },
      { id: "b", weight: 0.4 },
      { id: "c", weight: 0.1 },
      { id: "d", weight: 0.1 },
    ];
    const result = distributeCategories(20, weights);
    expect(result).toHaveLength(20);
    expect(new Set(result).size).toBeGreaterThan(1);
  });

  it("ne regroupe pas systématiquement une catégorie au début (répartition étalée)", () => {
    const result = distributeCategories(10, SAMPLE_WEIGHTS);
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

describe("filterByPlatform", () => {
  it("inclut un élément sans plateforme assignée, quelle que soit la plateforme demandée", () => {
    const items = [{ id: "a", platforms: [] }];
    expect(filterByPlatform(items, "tiktok")).toEqual(items);
    expect(filterByPlatform(items, "slack")).toEqual(items);
  });

  it("inclut un élément seulement si ses plateformes contiennent la plateforme demandée", () => {
    const items = [
      { id: "a", platforms: ["linkedin"] },
      { id: "b", platforms: ["slack"] },
    ];
    expect(filterByPlatform(items, "linkedin")).toEqual([items[0]]);
    expect(filterByPlatform(items, "slack")).toEqual([items[1]]);
    expect(filterByPlatform(items, "tiktok")).toEqual([]);
  });
});

describe("renormalizeCategoryWeights", () => {
  it("met à l'échelle un sous-ensemble pour qu'il somme à 1", () => {
    const result = renormalizeCategoryWeights([
      { id: "a", weight: 0.2 },
      { id: "b", weight: 0.15 },
    ]);
    const total = result.reduce((sum, w) => sum + w.weight, 0);
    expect(total).toBeCloseTo(1, 5);
    expect(result[0].weight).toBeCloseTo(0.2 / 0.35, 5);
    expect(result[1].weight).toBeCloseTo(0.15 / 0.35, 5);
  });

  it("ne change rien si l'ensemble somme déjà à 1", () => {
    expect(renormalizeCategoryWeights(SAMPLE_WEIGHTS)).toEqual(SAMPLE_WEIGHTS);
  });

  it("renvoie l'entrée telle quelle sans diviser par zéro si elle est vide", () => {
    expect(renormalizeCategoryWeights([])).toEqual([]);
  });
});

describe("seriesWeightsFromSeries", () => {
  it("convertit des poids 0-100 en fractions", () => {
    expect(seriesWeightsFromSeries([{ id: "a", weight: 20, categoryIds: ["cat1"] }])).toEqual([
      { id: "a", weight: 0.2, categoryIds: ["cat1"] },
    ]);
  });

  it("écarte les séries sans catégorie liée", () => {
    expect(seriesWeightsFromSeries([{ id: "a", weight: 20, categoryIds: [] }])).toEqual([]);
  });
});

describe("distributeSeriesOverrides", () => {
  const ONE_SERIES: SeriesWeight[] = [{ id: "serie-a", weight: 0.3, categoryIds: ["cat1"] }];

  it("renvoie une Map vide pour n <= 0", () => {
    expect(distributeSeriesOverrides(0, ONE_SERIES).size).toBe(0);
    expect(distributeSeriesOverrides(-3, ONE_SERIES).size).toBe(0);
  });

  it("renvoie une Map vide si aucune série n'est fournie", () => {
    expect(distributeSeriesOverrides(10, []).size).toBe(0);
  });

  it("ne force jamais 100% de couverture : des poids sommant à moins de 1 laissent des créneaux non couverts", () => {
    const result = distributeSeriesOverrides(20, ONE_SERIES); // 30% de 20 = 6
    expect(result.size).toBeLessThan(20);
    expect(result.size).toBeCloseTo(6, 0);
  });

  it("plafonne à la baisse (jamais à la hausse) quand la somme des poids dépasse 1", () => {
    const overSubscribed: SeriesWeight[] = [
      { id: "a", weight: 0.7, categoryIds: ["cat1"] },
      { id: "b", weight: 0.6, categoryIds: ["cat2"] },
    ];
    const result = distributeSeriesOverrides(10, overSubscribed);
    expect(result.size).toBeLessThanOrEqual(10);
  });

  it("alterne entre les catégories liées d'une série qui en couvre plusieurs", () => {
    const multiCategorySeries: SeriesWeight[] = [{ id: "serie-a", weight: 1, categoryIds: ["cat1", "cat2"] }];
    const result = distributeSeriesOverrides(10, multiCategorySeries);
    const categoriesUsed = new Set([...result.values()].map((v) => v.categoryId));
    expect(categoriesUsed.has("cat1")).toBe(true);
    expect(categoriesUsed.has("cat2")).toBe(true);
  });

  it("n'assigne jamais deux séries au même index", () => {
    const twoSeries: SeriesWeight[] = [
      { id: "a", weight: 0.5, categoryIds: ["cat1"] },
      { id: "b", weight: 0.5, categoryIds: ["cat2"] },
    ];
    const result = distributeSeriesOverrides(10, twoSeries);
    expect(result.size).toBeLessThanOrEqual(10);
    for (const [, assignment] of result) {
      expect(["a", "b"]).toContain(assignment.seriesId);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  aggregateCategorySignals,
  buildReasonSummary,
  buildReweightItems,
  clamp,
  computeCategoryPlatformSignals,
  computeProposedWeight,
  MAX_CATEGORY_WEIGHT,
  MAX_DELTA_PER_CYCLE,
  MIN_CATEGORY_WEIGHT,
  MIN_SAMPLES_PER_CATEGORY_PLATFORM,
  type EngagementSample,
} from "./categoryReweightService";

function sample(categoryId: string, platform: string, views: number, likes: number): EngagementSample {
  return { categoryId, platform, views, likes, comments: 0, shares: 0 };
}

describe("clamp", () => {
  it("borne une valeur entre min et max", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("computeCategoryPlatformSignals", () => {
  it("ignore un couple (catégorie, plateforme) sous le seuil minimal d'échantillons", () => {
    const samples = Array.from({ length: MIN_SAMPLES_PER_CATEGORY_PLATFORM - 1 }, () =>
      sample("cat-a", "tiktok", 1000, 100)
    );
    expect(computeCategoryPlatformSignals(samples)).toEqual([]);
  });

  it("calcule un signal dès que le seuil minimal est atteint", () => {
    const samples = Array.from({ length: MIN_SAMPLES_PER_CATEGORY_PLATFORM }, () =>
      sample("cat-a", "tiktok", 1000, 100)
    );
    const signals = computeCategoryPlatformSignals(samples);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ categoryId: "cat-a", platform: "tiktok", sampleCount: MIN_SAMPLES_PER_CATEGORY_PLATFORM });
  });

  it("donne un z-score positif à une catégorie qui engage mieux que la moyenne de sa plateforme", () => {
    const samples = [
      ...Array.from({ length: 5 }, () => sample("cat-fort", "tiktok", 1000, 200)), // rate = 0.2
      ...Array.from({ length: 5 }, () => sample("cat-faible", "tiktok", 1000, 20)), // rate = 0.02
    ];
    const signals = computeCategoryPlatformSignals(samples);
    const fort = signals.find((s) => s.categoryId === "cat-fort")!;
    const faible = signals.find((s) => s.categoryId === "cat-faible")!;
    expect(fort.zAvg).toBeGreaterThan(0);
    expect(faible.zAvg).toBeLessThan(0);
  });

  it("normalise indépendamment par plateforme (TikTok et LinkedIn ne se mélangent pas)", () => {
    // Même catégorie, deux plateformes à des ordres de grandeur totalement différents.
    const samples = [
      ...Array.from({ length: 5 }, () => sample("cat-a", "tiktok", 100000, 5000)),
      ...Array.from({ length: 5 }, () => sample("cat-a", "linkedin", 500, 10)),
    ];
    const signals = computeCategoryPlatformSignals(samples);
    // Un seul échantillon par (catégorie, plateforme) homogène => écart-type nul => z = 0 partout.
    expect(signals.every((s) => s.zAvg === 0)).toBe(true);
  });

  it("renvoie un tableau vide pour une liste d'échantillons vide", () => {
    expect(computeCategoryPlatformSignals([])).toEqual([]);
  });
});

describe("aggregateCategorySignals", () => {
  it("agrège plusieurs plateformes pour une même catégorie par moyenne pondérée par échantillon", () => {
    const result = aggregateCategorySignals([
      { categoryId: "cat-a", platform: "tiktok", zAvg: 1, sampleCount: 10 },
      { categoryId: "cat-a", platform: "linkedin", zAvg: -1, sampleCount: 10 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].categoryScore).toBeCloseTo(0, 5);
  });

  it("plafonne la contribution d'une plateforme à fort volume (PLATFORM_SAMPLE_CAP)", () => {
    const result = aggregateCategorySignals([
      { categoryId: "cat-a", platform: "tiktok", zAvg: 1, sampleCount: 1000 },
      { categoryId: "cat-a", platform: "linkedin", zAvg: -1, sampleCount: 20 },
    ]);
    // Les deux plateformes sont plafonnées au même cap (20) => moyenne exactement 0, pas noyée par tiktok.
    expect(result[0].categoryScore).toBeCloseTo(0, 5);
  });

  it("garde les catégories séparées", () => {
    const result = aggregateCategorySignals([
      { categoryId: "cat-a", platform: "tiktok", zAvg: 1, sampleCount: 10 },
      { categoryId: "cat-b", platform: "tiktok", zAvg: -1, sampleCount: 10 },
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("computeProposedWeight", () => {
  it("ne change rien pour un z-score nul", () => {
    expect(computeProposedWeight(30, 0)).toBe(30);
  });

  it("augmente le poids pour un score positif", () => {
    expect(computeProposedWeight(30, 1)).toBeGreaterThan(30);
  });

  it("diminue le poids pour un score négatif", () => {
    expect(computeProposedWeight(30, -1)).toBeLessThan(30);
  });

  it("plafonne le delta par cycle même pour un score extrême", () => {
    const result = computeProposedWeight(30, 100);
    // MAX_DELTA_PER_CYCLE=8, DAMPING_FACTOR=0.5 => delta appliqué max = 4
    expect(result).toBe(30 + MAX_DELTA_PER_CYCLE * 0.5);
  });

  it("ne descend jamais sous MIN_CATEGORY_WEIGHT ni au-dessus de MAX_CATEGORY_WEIGHT", () => {
    expect(computeProposedWeight(5, -100)).toBe(MIN_CATEGORY_WEIGHT);
    expect(computeProposedWeight(95, 100)).toBe(MAX_CATEGORY_WEIGHT);
  });
});

describe("buildReweightItems", () => {
  const categories = [
    { id: "cat-fort", label: "Coulisses", weight: 30 },
    { id: "cat-faible", label: "Promo produit", weight: 30 },
    { id: "cat-neutre", label: "Éducatif", weight: 40 },
  ];

  it("renvoie [] si moins de 2 catégories ont un signal comparable", () => {
    const samples = Array.from({ length: MIN_SAMPLES_PER_CATEGORY_PLATFORM }, () =>
      sample("cat-fort", "tiktok", 1000, 100)
    );
    expect(buildReweightItems(categories, samples)).toEqual([]);
  });

  it("produit des items uniquement pour les catégories avec un delta non nul", () => {
    const samples = [
      ...Array.from({ length: 8 }, () => sample("cat-fort", "tiktok", 1000, 300)), // rate 0.3
      ...Array.from({ length: 8 }, () => sample("cat-faible", "tiktok", 1000, 10)), // rate 0.01
    ];
    const items = buildReweightItems(categories, samples);
    const ids = items.map((i) => i.targetId);
    expect(ids).toContain("cat-fort");
    expect(ids).toContain("cat-faible");
    expect(ids).not.toContain("cat-neutre"); // pas de signal du tout pour cette catégorie

    const fort = items.find((i) => i.targetId === "cat-fort")!;
    const faible = items.find((i) => i.targetId === "cat-faible")!;
    expect(fort.proposedWeight).toBeGreaterThan(fort.previousWeight);
    expect(faible.proposedWeight).toBeLessThan(faible.previousWeight);
  });

  it("n'inclut jamais un item dont le poids proposé égale le poids actuel", () => {
    const samples = [
      ...Array.from({ length: 8 }, () => sample("cat-fort", "tiktok", 1000, 100)),
      ...Array.from({ length: 8 }, () => sample("cat-faible", "tiktok", 1000, 100)),
    ];
    // Mêmes taux d'engagement => z-scores ~0 des deux côtés => pas de delta.
    expect(buildReweightItems(categories, samples)).toEqual([]);
  });
});

describe("buildReasonSummary", () => {
  it("mentionne les catégories qui montent et celles qui descendent", () => {
    const text = buildReasonSummary([
      { targetId: "a", label: "Coulisses", previousWeight: 30, proposedWeight: 34, sampleCount: 8, categoryScore: 1 },
      { targetId: "b", label: "Promo produit", previousWeight: 30, proposedWeight: 26, sampleCount: 8, categoryScore: -1 },
    ]);
    expect(text).toContain("Coulisses");
    expect(text).toContain("Promo produit");
  });

  it("renvoie un texte de repli si items est vide", () => {
    expect(buildReasonSummary([])).toMatch(/Rééquilibrage/);
  });
});

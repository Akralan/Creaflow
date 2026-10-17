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
  it("clamps a value between min and max", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("computeCategoryPlatformSignals", () => {
  it("ignores a (category, platform) pair below the minimum sample threshold", () => {
    const samples = Array.from({ length: MIN_SAMPLES_PER_CATEGORY_PLATFORM - 1 }, () =>
      sample("cat-a", "instagram", 1000, 100)
    );
    expect(computeCategoryPlatformSignals(samples)).toEqual([]);
  });

  it("computes a signal as soon as the minimum threshold is reached", () => {
    const samples = Array.from({ length: MIN_SAMPLES_PER_CATEGORY_PLATFORM }, () =>
      sample("cat-a", "instagram", 1000, 100)
    );
    const signals = computeCategoryPlatformSignals(samples);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ categoryId: "cat-a", platform: "instagram", sampleCount: MIN_SAMPLES_PER_CATEGORY_PLATFORM });
  });

  it("gives a positive z-score to a category that engages better than its platform's average", () => {
    const samples = [
      ...Array.from({ length: 5 }, () => sample("cat-fort", "instagram", 1000, 200)), // rate = 0.2
      ...Array.from({ length: 5 }, () => sample("cat-faible", "instagram", 1000, 20)), // rate = 0.02
    ];
    const signals = computeCategoryPlatformSignals(samples);
    const fort = signals.find((s) => s.categoryId === "cat-fort")!;
    const faible = signals.find((s) => s.categoryId === "cat-faible")!;
    expect(fort.zAvg).toBeGreaterThan(0);
    expect(faible.zAvg).toBeLessThan(0);
  });

  it("normalizes independently per platform (Instagram and LinkedIn do not mix)", () => {
    // Same category, two platforms with completely different orders of magnitude.
    const samples = [
      ...Array.from({ length: 5 }, () => sample("cat-a", "instagram", 100000, 5000)),
      ...Array.from({ length: 5 }, () => sample("cat-a", "linkedin", 500, 10)),
    ];
    const signals = computeCategoryPlatformSignals(samples);
    // A single sample per homogeneous (category, platform) => zero standard deviation => z = 0 everywhere.
    expect(signals.every((s) => s.zAvg === 0)).toBe(true);
  });

  it("returns an empty array for an empty list of samples", () => {
    expect(computeCategoryPlatformSignals([])).toEqual([]);
  });
});

describe("aggregateCategorySignals", () => {
  it("aggregates several platforms for the same category by sample-weighted mean", () => {
    const result = aggregateCategorySignals([
      { categoryId: "cat-a", platform: "instagram", zAvg: 1, sampleCount: 10 },
      { categoryId: "cat-a", platform: "linkedin", zAvg: -1, sampleCount: 10 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].categoryScore).toBeCloseTo(0, 5);
  });

  it("caps the contribution of a high-volume platform (PLATFORM_SAMPLE_CAP)", () => {
    const result = aggregateCategorySignals([
      { categoryId: "cat-a", platform: "instagram", zAvg: 1, sampleCount: 1000 },
      { categoryId: "cat-a", platform: "linkedin", zAvg: -1, sampleCount: 20 },
    ]);
    // Both platforms are capped at the same cap (20) => mean exactly 0, not drowned by instagram.
    expect(result[0].categoryScore).toBeCloseTo(0, 5);
  });

  it("keeps categories separate", () => {
    const result = aggregateCategorySignals([
      { categoryId: "cat-a", platform: "instagram", zAvg: 1, sampleCount: 10 },
      { categoryId: "cat-b", platform: "instagram", zAvg: -1, sampleCount: 10 },
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("computeProposedWeight", () => {
  it("changes nothing for a zero z-score", () => {
    expect(computeProposedWeight(30, 0)).toBe(30);
  });

  it("increases the weight for a positive score", () => {
    expect(computeProposedWeight(30, 1)).toBeGreaterThan(30);
  });

  it("decreases the weight for a negative score", () => {
    expect(computeProposedWeight(30, -1)).toBeLessThan(30);
  });

  it("caps the delta per cycle even for an extreme score", () => {
    const result = computeProposedWeight(30, 100);
    // MAX_DELTA_PER_CYCLE=8, DAMPING_FACTOR=0.5 => max applied delta = 4
    expect(result).toBe(30 + MAX_DELTA_PER_CYCLE * 0.5);
  });

  it("never goes below MIN_CATEGORY_WEIGHT nor above MAX_CATEGORY_WEIGHT", () => {
    expect(computeProposedWeight(5, -100)).toBe(MIN_CATEGORY_WEIGHT);
    expect(computeProposedWeight(95, 100)).toBe(MAX_CATEGORY_WEIGHT);
  });
});

describe("buildReweightItems", () => {
  const categories = [
    { id: "cat-fort", label: "Coulisses", weight: 30 },
    { id: "cat-faible", label: "Product promo", weight: 30 },
    { id: "cat-neutre", label: "Educational", weight: 40 },
  ];

  it("returns [] if fewer than 2 categories have a comparable signal", () => {
    const samples = Array.from({ length: MIN_SAMPLES_PER_CATEGORY_PLATFORM }, () =>
      sample("cat-fort", "instagram", 1000, 100)
    );
    expect(buildReweightItems(categories, samples)).toEqual([]);
  });

  it("produces items only for categories with a non-zero delta", () => {
    const samples = [
      ...Array.from({ length: 8 }, () => sample("cat-fort", "instagram", 1000, 300)), // rate 0.3
      ...Array.from({ length: 8 }, () => sample("cat-faible", "instagram", 1000, 10)), // rate 0.01
    ];
    const items = buildReweightItems(categories, samples);
    const ids = items.map((i) => i.targetId);
    expect(ids).toContain("cat-fort");
    expect(ids).toContain("cat-faible");
    expect(ids).not.toContain("cat-neutre"); // no signal at all for this category

    const fort = items.find((i) => i.targetId === "cat-fort")!;
    const faible = items.find((i) => i.targetId === "cat-faible")!;
    expect(fort.proposedWeight).toBeGreaterThan(fort.previousWeight);
    expect(faible.proposedWeight).toBeLessThan(faible.previousWeight);
  });

  it("never includes an item whose proposed weight equals the current weight", () => {
    const samples = [
      ...Array.from({ length: 8 }, () => sample("cat-fort", "instagram", 1000, 100)),
      ...Array.from({ length: 8 }, () => sample("cat-faible", "instagram", 1000, 100)),
    ];
    // Same engagement rates => z-scores ~0 on both sides => no delta.
    expect(buildReweightItems(categories, samples)).toEqual([]);
  });
});

describe("buildReasonSummary", () => {
  it("mentions the categories that go up and those that go down", () => {
    const text = buildReasonSummary([
      { targetId: "a", label: "Coulisses", previousWeight: 30, proposedWeight: 34, sampleCount: 8, categoryScore: 1 },
      { targetId: "b", label: "Product promo", previousWeight: 30, proposedWeight: 26, sampleCount: 8, categoryScore: -1 },
    ]);
    expect(text).toContain("Coulisses");
    expect(text).toContain("Product promo");
  });

  it("returns a fallback text if items is empty", () => {
    expect(buildReasonSummary([])).toMatch(/Rebalancing/);
  });
});

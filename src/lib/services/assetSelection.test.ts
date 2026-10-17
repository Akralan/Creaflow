import { describe, expect, it } from "vitest";
import { buildAssetSearchQuery } from "./assetSelection";

describe("buildAssetSearchQuery", () => {
  it("always includes the category", () => {
    expect(buildAssetSearchQuery({ categoryLabel: "Behind the scenes", categoryDescription: "Daily life in the workshop" })).toBe(
      "Content category: Behind the scenes — Daily life in the workshop."
    );
  });

  it("adds the topic when provided", () => {
    const query = buildAssetSearchQuery({
      categoryLabel: "Promotional",
      categoryDescription: "Showcasing a product.",
      productName: "Amber Candle",
    });
    expect(query).toContain("Topic: Amber Candle.");
  });

  it("adds the series when provided", () => {
    const query = buildAssetSearchQuery({
      categoryLabel: "Educational",
      categoryDescription: "Explains a craft skill.",
      seriesLabel: "Wednesday myth",
    });
    expect(query).toContain("Series: Wednesday myth.");
  });

  it("ignores absent topic/series (null or undefined)", () => {
    const query = buildAssetSearchQuery({
      categoryLabel: "Behind the scenes",
      categoryDescription: "Daily life in the workshop.",
      productName: null,
      seriesLabel: undefined,
    });
    expect(query).not.toContain("Topic");
    expect(query).not.toContain("Series");
  });
});

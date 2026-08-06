import { describe, expect, it } from "vitest";
import { buildAssetSearchQuery } from "./assetSelection";

describe("buildAssetSearchQuery", () => {
  it("inclut toujours la catégorie", () => {
    expect(buildAssetSearchQuery({ categoryLabel: "Coulisses", categoryDescription: "Le quotidien de l'atelier" })).toBe(
      "Catégorie de contenu : Coulisses — Le quotidien de l'atelier."
    );
  });

  it("ajoute le produit quand fourni", () => {
    const query = buildAssetSearchQuery({
      categoryLabel: "Promotionnel",
      categoryDescription: "Mise en avant d'un produit.",
      productName: "Bougie Ambre",
    });
    expect(query).toContain("Produit : Bougie Ambre.");
  });

  it("ajoute la série quand fournie", () => {
    const query = buildAssetSearchQuery({
      categoryLabel: "Éducatif",
      categoryDescription: "Explique un savoir-faire.",
      seriesLabel: "Le mythe du mercredi",
    });
    expect(query).toContain("Série : Le mythe du mercredi.");
  });

  it("ignore produit/série absents (null ou undefined)", () => {
    const query = buildAssetSearchQuery({
      categoryLabel: "Coulisses",
      categoryDescription: "Le quotidien de l'atelier.",
      productName: null,
      seriesLabel: undefined,
    });
    expect(query).not.toContain("Produit");
    expect(query).not.toContain("Série");
  });
});

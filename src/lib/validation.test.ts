import { describe, expect, it } from "vitest";
import { contentCategorySchema, platformSchema } from "./validation";

describe("platformSchema", () => {
  it("accepte les plateformes valides", () => {
    for (const platform of ["tiktok", "instagram", "linkedin"]) {
      expect(() => platformSchema.parse(platform)).not.toThrow();
    }
  });

  it("rejette une plateforme inconnue", () => {
    expect(() => platformSchema.parse("facebook")).toThrow();
  });
});

describe("contentCategorySchema", () => {
  it("accepte les catégories valides", () => {
    for (const category of ["vente", "coulisses", "educatif"]) {
      expect(() => contentCategorySchema.parse(category)).not.toThrow();
    }
  });

  it("rejette une catégorie inconnue", () => {
    expect(() => contentCategorySchema.parse("divertissement")).toThrow();
  });
});

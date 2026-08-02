import { describe, expect, it } from "vitest";
import { contentCategorySchema, platformSchema } from "./validation";

describe("platformSchema", () => {
  it("accepte les plateformes valides, avec ou sans provider OAuth", () => {
    for (const platform of ["tiktok", "instagram", "linkedin", "x", "youtube", "newsletter", "blog", "other"]) {
      expect(() => platformSchema.parse(platform)).not.toThrow();
    }
  });

  it("rejette une plateforme inconnue", () => {
    expect(() => platformSchema.parse("facebook")).toThrow();
  });
});

describe("contentCategorySchema", () => {
  it("accepte un uuid valide", () => {
    expect(() => contentCategorySchema.parse("3fa85f64-5717-4562-b3fc-2c963f66afa6")).not.toThrow();
  });

  it("rejette une valeur qui n'est pas un uuid", () => {
    expect(() => contentCategorySchema.parse("vente")).toThrow();
  });
});

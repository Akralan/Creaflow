import { describe, expect, it } from "vitest";
import { contentCategorySchema, platformSchema } from "./validation";

describe("platformSchema", () => {
  it("accepts valid platforms, with or without an OAuth provider", () => {
    for (const platform of ["instagram", "linkedin", "x", "newsletter", "blog", "other"]) {
      expect(() => platformSchema.parse(platform)).not.toThrow();
    }
  });

  it("rejects an unknown platform", () => {
    expect(() => platformSchema.parse("facebook")).toThrow();
    // Removed along with video (docs/SPEC_ONBOARDING_MVP.md §6).
    expect(() => platformSchema.parse("tiktok")).toThrow();
    expect(() => platformSchema.parse("youtube")).toThrow();
  });
});

describe("contentCategorySchema", () => {
  it("accepte un uuid valide", () => {
    expect(() => contentCategorySchema.parse("3fa85f64-5717-4562-b3fc-2c963f66afa6")).not.toThrow();
  });

  it("rejects a value that is not a uuid", () => {
    expect(() => contentCategorySchema.parse("vente")).toThrow();
  });
});

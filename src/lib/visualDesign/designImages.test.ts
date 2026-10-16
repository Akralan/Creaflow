import { describe, expect, it } from "vitest";
import { collectImageRefs, designImagesSchema, imagePlaceholder, nextImageRef, parseImagePlaceholder, parseStoredDesignImages } from "./designImages";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("designImagesSchema", () => {
  it("accepte une liste valide", () => {
    const list = [
      { ref: "p1", assetId: ID_A, variant: "original" },
      { ref: "p2", assetId: ID_B, variant: "cutout" },
    ];
    expect(designImagesSchema.parse(list)).toEqual(list);
  });

  it("refuse les références hors p1-p6, les doublons de ref et de photo, et plus de 6 photos", () => {
    expect(designImagesSchema.safeParse([{ ref: "p7", assetId: ID_A, variant: "original" }]).success).toBe(false);
    expect(designImagesSchema.safeParse([{ ref: "base", assetId: ID_A, variant: "original" }]).success).toBe(false);
    expect(
      designImagesSchema.safeParse([
        { ref: "p1", assetId: ID_A, variant: "original" },
        { ref: "p1", assetId: ID_B, variant: "original" },
      ]).success
    ).toBe(false);
    expect(
      designImagesSchema.safeParse([
        { ref: "p1", assetId: ID_A, variant: "original" },
        { ref: "p2", assetId: ID_A, variant: "cutout" },
      ]).success
    ).toBe(false);
    const seven = Array.from({ length: 7 }, (_, i) => ({ ref: `p${i + 1}`, assetId: ID_A.replace("1111111111", String(i).padStart(10, "0")), variant: "original" }));
    expect(designImagesSchema.safeParse(seven).success).toBe(false);
  });
});

describe("placeholders", () => {
  it("construit et relit un placeholder", () => {
    expect(imagePlaceholder("p3")).toBe("{{IMG:p3}}");
    expect(parseImagePlaceholder("{{IMG:p3}}")).toBe("p3");
    expect(parseImagePlaceholder("{{BASE_IMAGE}}")).toBeNull();
    expect(parseImagePlaceholder("https://evil")).toBeNull();
  });

  it("collecte les références utilisées, sans doublon, dans l'ordre", () => {
    const html = `<div><img src="{{IMG:p2}}"><img src="{{IMG:p1}}"><img src="{{IMG:p2}}"><img src="{{LOGO}}"></div>`;
    expect(collectImageRefs(html)).toEqual(["p2", "p1"]);
  });

  it("trouve la première référence libre", () => {
    expect(nextImageRef([])).toBe("p1");
    expect(nextImageRef([{ ref: "p1" }, { ref: "p3" }])).toBe("p2");
    expect(nextImageRef(["p1", "p2", "p3", "p4", "p5", "p6"].map((ref) => ({ ref })))).toBeNull();
  });

  it("lit une colonne absente ou invalide comme une liste vide", () => {
    expect(parseStoredDesignImages(null)).toEqual([]);
    expect(parseStoredDesignImages("nope")).toEqual([]);
  });
});

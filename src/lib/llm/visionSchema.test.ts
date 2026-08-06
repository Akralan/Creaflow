import { describe, expect, it } from "vitest";
import { brandAssetCaptionSchema, captionBrandAssetTool } from "./visionSchema";

const validCaption = {
  description: "Bougie ambrée posée sur une table en bois clair.",
  mainSubject: "Bougie",
  mood: "chaleureux",
  orientation: "landscape",
  hasEmbeddedText: false,
  dominantColor: "ambre",
  matchedProductName: "Bougie Ambre",
};

describe("brandAssetCaptionSchema", () => {
  it("accepte une caption complète et valide", () => {
    expect(() => brandAssetCaptionSchema.parse(validCaption)).not.toThrow();
  });

  it("rejette une orientation hors de l'énumération attendue", () => {
    expect(() => brandAssetCaptionSchema.parse({ ...validCaption, orientation: "diagonal" })).toThrow();
  });

  it("rejette un champ requis manquant", () => {
    const { hasEmbeddedText: _omitted, ...incomplete } = validCaption;
    void _omitted;
    expect(() => brandAssetCaptionSchema.parse(incomplete)).toThrow();
  });

  it("transforme une chaîne vide en null pour matchedProductName (aucune correspondance)", () => {
    const result = brandAssetCaptionSchema.parse({ ...validCaption, matchedProductName: "" });
    expect(result.matchedProductName).toBeNull();
  });

  it("trim un matchedProductName non vide sans le mettre à null", () => {
    const result = brandAssetCaptionSchema.parse({ ...validCaption, matchedProductName: "  Bougie Ambre  " });
    expect(result.matchedProductName).toBe("Bougie Ambre");
  });
});

describe("captionBrandAssetTool", () => {
  it("expose tous les champs du schéma comme requis", () => {
    expect(captionBrandAssetTool.input_schema.required).toEqual(
      expect.arrayContaining([
        "description",
        "mainSubject",
        "mood",
        "orientation",
        "hasEmbeddedText",
        "dominantColor",
        "matchedProductName",
      ])
    );
  });
});

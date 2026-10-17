import { z } from "zod";
import type { LlmToolDefinition } from "./types";

// Captioning at BrandAsset ingestion (docs/SPEC_RESSOURCES_VISUELLES.md §5.1) — called only
// once per image, never replayed except on checksum change.
export const brandAssetCaptionSchema = z.object({
  description: z.string().min(1),
  mainSubject: z.string().min(1),
  mood: z.string().min(1),
  orientation: z.enum(["portrait", "landscape", "square"]),
  hasEmbeddedText: z.boolean(),
  dominantColor: z.string().min(1),
  // Automatic attachment to a catalog Product by name, "the highest-yield field"
  // according to the framing — empty string if no obvious match (see the comment on the tool schema
  // below: we avoid JSON Schema type unions, poorly supported by some function-calling
  // converters).
  matchedProductName: z.string().transform((v) => v.trim() || null),
});
export type BrandAssetCaption = z.infer<typeof brandAssetCaptionSchema>;

export const CAPTION_BRAND_ASSET_TOOL_NAME = "caption_brand_asset";

export const captionBrandAssetTool: LlmToolDefinition = {
  name: CAPTION_BRAND_ASSET_TOOL_NAME,
  description: "Describes a brand photo to index it in a library of visual resources. All text in English.",
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string", description: "One-sentence description of what the photo shows." },
      mainSubject: { type: "string", description: "Main subject of the photo (object, person, scene)." },
      mood: { type: "string", description: "General mood given off by the photo (e.g. warm, clean, raw)." },
      orientation: { type: "string", enum: ["portrait", "landscape", "square"], description: "Orientation of the image." },
      hasEmbeddedText: { type: "boolean", description: "True if text is visually embedded in the image." },
      dominantColor: { type: "string", description: "Dominant color of the photo (e.g. terracotta, midnight blue)." },
      matchedProductName: {
        type: "string",
        description:
          "Exact name of the catalog product (supplied in the context) that this photo most probably represents. Empty string if no clear match.",
      },
    },
    required: ["description", "mainSubject", "mood", "orientation", "hasEmbeddedText", "dominantColor", "matchedProductName"],
  },
};

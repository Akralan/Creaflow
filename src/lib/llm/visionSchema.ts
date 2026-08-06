import { z } from "zod";
import type { LlmToolDefinition } from "./types";

// Captioning à l'ingestion d'un BrandAsset (docs/SPEC_RESSOURCES_VISUELLES.md §5.1) — appelé une
// seule fois par image, jamais rejoué sauf changement de checksum.
export const brandAssetCaptionSchema = z.object({
  description: z.string().min(1),
  mainSubject: z.string().min(1),
  mood: z.string().min(1),
  orientation: z.enum(["portrait", "landscape", "square"]),
  hasEmbeddedText: z.boolean(),
  dominantColor: z.string().min(1),
  // Rattachement automatique à un Product du catalogue par nom, "le champ à plus fort rendement"
  // selon le cadrage — chaîne vide si aucune correspondance évidente (cf. commentaire sur le schéma
  // d'outil ci-dessous : on évite les unions de type JSON Schema, mal supportées par certains
  // convertisseurs de function-calling).
  matchedProductName: z.string().transform((v) => v.trim() || null),
});
export type BrandAssetCaption = z.infer<typeof brandAssetCaptionSchema>;

export const CAPTION_BRAND_ASSET_TOOL_NAME = "caption_brand_asset";

export const captionBrandAssetTool: LlmToolDefinition = {
  name: CAPTION_BRAND_ASSET_TOOL_NAME,
  description: "Décrit une photo de marque pour l'indexer dans une bibliothèque de ressources visuelles.",
  input_schema: {
    type: "object",
    properties: {
      description: { type: "string", description: "Description en une phrase de ce que montre la photo." },
      mainSubject: { type: "string", description: "Sujet principal de la photo (objet, personne, scène)." },
      mood: { type: "string", description: "Ambiance générale dégagée par la photo (ex: chaleureux, épuré, brut)." },
      orientation: { type: "string", enum: ["portrait", "landscape", "square"], description: "Orientation de l'image." },
      hasEmbeddedText: { type: "boolean", description: "Vrai si du texte est incrusté visuellement dans l'image." },
      dominantColor: { type: "string", description: "Dominante colorimétrique de la photo (ex: terracotta, bleu nuit)." },
      matchedProductName: {
        type: "string",
        description:
          "Nom exact du produit du catalogue (fourni dans le contexte) que cette photo représente le plus probablement. Chaîne vide si aucune correspondance claire.",
      },
    },
    required: ["description", "mainSubject", "mood", "orientation", "hasEmbeddedText", "dominantColor", "matchedProductName"],
  },
};

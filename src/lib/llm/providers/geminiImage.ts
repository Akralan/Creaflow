import { FunctionCallingConfigMode, Modality } from "@google/genai";
import { getGeminiClient } from "./geminiClient";
import type { LlmToolDefinition } from "../types";
import { buildStagingPrompt } from "../imageGenPrompts";

const CAPTION_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";

/**
 * Chemin dédié au captioning vision — hors `callStructured` (texte uniquement, cf.
 * src/lib/llm/provider.ts) puisqu'il faut ici passer une image en entrée via `inlineData`.
 */
export async function captionImage(
  bytes: Buffer,
  mimeType: string,
  system: string,
  tool: LlmToolDefinition
): Promise<unknown> {
  const response = await getGeminiClient().models.generateContent({
    model: CAPTION_MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: system }, { inlineData: { mimeType, data: bytes.toString("base64") } }],
      },
    ],
    config: {
      tools: [
        {
          functionDeclarations: [
            { name: tool.name, description: tool.description, parametersJsonSchema: tool.input_schema },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: [tool.name] },
      },
    },
  });

  const call = response.functionCalls?.[0];
  if (!call) {
    throw new Error("Le modèle n'a pas renvoyé de caption structurée.");
  }
  return call.args;
}

export interface StagedImageResult {
  bytes: Buffer;
  mimeType: string;
}

/**
 * Édition conditionnée par image de référence ("Nano Banana") — un seul mode existe : la mise en
 * scène. Aucun paramètre ne permet de basculer vers une "transformation du produit" (garde-fou
 * structurel, cf. docs/SPEC_RESSOURCES_VISUELLES.md §6.1 et src/lib/llm/imageGenPrompts.ts).
 */
export async function generateStagedImage(params: {
  referenceImages: Array<{ bytes: Buffer; mimeType: string }>;
  instruction: string;
}): Promise<StagedImageResult> {
  const response = await getGeminiClient().models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          ...params.referenceImages.map((img) => ({
            inlineData: { mimeType: img.mimeType, data: img.bytes.toString("base64") },
          })),
          { text: buildStagingPrompt(params.instruction) },
        ],
      },
    ],
    config: { responseModalities: [Modality.IMAGE] },
  });

  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData?.data) {
    throw new Error("Le modèle n'a pas renvoyé d'image.");
  }
  return {
    bytes: Buffer.from(part.inlineData.data, "base64"),
    mimeType: part.inlineData.mimeType || "image/png",
  };
}

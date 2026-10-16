import { FunctionCallingConfigMode } from "@google/genai";
import { getGeminiClient } from "./geminiClient";
import type { LlmToolDefinition } from "../types";

const CAPTION_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

/**
 * Chemin dédié au captioning vision — hors `callStructured` (texte uniquement, cf.
 * src/lib/llm/provider.ts) puisqu'il faut ici passer une image en entrée via `inlineData`. C'est le
 * seul usage image de Gemini qui subsiste : la génération d'image (Nano Banana) a été retirée
 * (docs/SPEC_COMPOSITION_VISUELLE.md §1).
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

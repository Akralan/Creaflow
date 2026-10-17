import { FunctionCallingConfigMode } from "@google/genai";
import { getGeminiClient } from "./geminiClient";
import type { LlmToolDefinition } from "../types";

const CAPTION_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

/**
 * Dedicated path for vision captioning — outside `callStructured` (text only, see
 * src/lib/llm/provider.ts) since an image must be passed as input here via `inlineData`. It is the
 * only remaining image use of Gemini: image generation (Nano Banana) was removed
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
    throw new Error("The model did not return a structured caption.");
  }
  return call.args;
}

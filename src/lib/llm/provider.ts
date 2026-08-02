import type { StructuredCallParams } from "./types";
import { callAnthropic } from "./providers/anthropic";
import { callGemini } from "./providers/gemini";

export async function callStructured(params: StructuredCallParams): Promise<unknown> {
  const provider = process.env.LLM_PROVIDER || "gemini";

  switch (provider) {
    case "gemini":
      return callGemini(params);
    case "anthropic":
      return callAnthropic(params);
    default:
      throw new Error(`LLM_PROVIDER inconnu : "${provider}" (attendu "gemini" ou "anthropic").`);
  }
}

import type { AgenticCallParams, AgenticResult, StructuredCallParams } from "./types";
import { callAnthropic } from "./providers/anthropic";
import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";
import { callOpenAI, callOpenAIAgentic } from "./providers/openai";
import { logger } from "@/lib/logger";

// Reminder added to the system prompt for the retry — some models (notably via Groq)
// sometimes answer in free text despite a forced tool_choice; an explicit reminder on the 2nd try
// is generally enough to set things right.
const TOOL_CALL_RETRY_NOTE =
  "\n\nIMPORTANT REMINDER: your previous response did not call the required tool. You MUST call the provided tool, with all the required fields filled in. Write nothing outside the tool call.";

function callProvider(provider: string, params: StructuredCallParams): Promise<unknown> {
  switch (provider) {
    case "gemini":
      return callGemini(params);
    case "anthropic":
      return callAnthropic(params);
    case "groq":
      return callGroq(params);
    case "openai":
      return callOpenAI(params);
    default:
      throw new Error(`Unknown LLM_PROVIDER: "${provider}" (expected "gemini", "anthropic", "groq" or "openai").`);
  }
}

/**
 * Agentic loop — N tools not forced, several round trips (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.2).
 *
 * Deliberately does NOT consult `LLM_PROVIDER`: the loop is only implemented for OpenAI, and
 * `LLM_PROVIDER` drives content generation, not all of the product's capabilities. Same stance
 * as embeddings and image generation, hard-wired to Gemini for the same reason
 * (embeddings.ts, providers/geminiImage.ts).
 *
 * No `TOOL_CALL_RETRY_NOTE` safety net here: answering in free text is a legitimate outcome of an
 * agentic turn, there is nothing to catch.
 */
export async function callAgentic(params: AgenticCallParams): Promise<AgenticResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required for the assistant: the agentic loop only exists with OpenAI, regardless of LLM_PROVIDER."
    );
  }
  return callOpenAIAgentic(params);
}


export async function callStructured(params: StructuredCallParams): Promise<unknown> {
  const provider = process.env.LLM_PROVIDER || "gemini";

  try {
    return await callProvider(provider, params);
  } catch (err) {
    logger.warn("First structured LLM call failed, retrying with reminder", { provider, err: String(err) });
    return await callProvider(provider, { ...params, system: params.system + TOOL_CALL_RETRY_NOTE });
  }
}

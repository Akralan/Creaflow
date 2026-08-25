import type { StructuredCallParams } from "./types";
import { callAnthropic } from "./providers/anthropic";
import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";
import { callOpenAI } from "./providers/openai";
import { logger } from "@/lib/logger";

// Rappel ajouté au system prompt pour la nouvelle tentative — certains modèles (notamment via Groq)
// répondent parfois en texte libre malgré un tool_choice forcé ; un rappel explicite au 2e essai
// suffit généralement à corriger le tir.
const TOOL_CALL_RETRY_NOTE =
  '\n\nRAPPEL IMPORTANT : ta réponse précédente n\'a pas respecté le format d\'appel d\'outil requis (tu as répondu en texte libre au lieu d\'appeler l\'outil). Tu DOIS impérativement appeler l\'outil fourni, avec tous les champs requis remplis — mets ta réponse conversationnelle dans le champ "assistantReply" de l\'outil, jamais en dehors.';

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
      throw new Error(`LLM_PROVIDER inconnu : "${provider}" (attendu "gemini", "anthropic", "groq" ou "openai").`);
  }
}

export async function callStructured(params: StructuredCallParams): Promise<unknown> {
  const provider = process.env.LLM_PROVIDER || "gemini";

  try {
    return await callProvider(provider, params);
  } catch (err) {
    logger.warn("Premier appel structuré LLM échoué, nouvelle tentative avec rappel", { provider, err: String(err) });
    return await callProvider(provider, { ...params, system: params.system + TOOL_CALL_RETRY_NOTE });
  }
}

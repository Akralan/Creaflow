import type { AgenticCallParams, AgenticResult, StructuredCallParams, WebResearchParams, WebResearchResult } from "./types";
import { callAnthropic } from "./providers/anthropic";
import { callGemini } from "./providers/gemini";
import { callGroq } from "./providers/groq";
import { callOpenAI, callOpenAIAgentic, callOpenAIWebResearch } from "./providers/openai";
import { logger } from "@/lib/logger";

// Rappel ajouté au system prompt pour la nouvelle tentative — certains modèles (notamment via Groq)
// répondent parfois en texte libre malgré un tool_choice forcé ; un rappel explicite au 2e essai
// suffit généralement à corriger le tir.
const TOOL_CALL_RETRY_NOTE =
  "\n\nRAPPEL IMPORTANT : ta réponse précédente n'a pas appelé l'outil requis. Tu DOIS appeler l'outil fourni, avec tous les champs requis remplis. N'écris rien en dehors de l'appel d'outil.";

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

/**
 * Boucle agentique — N outils non imposés, plusieurs allers-retours (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.2).
 *
 * Ne consulte volontairement PAS `LLM_PROVIDER` : la boucle n'est implémentée que pour OpenAI, et
 * `LLM_PROVIDER` pilote la génération de contenu, pas toutes les capacités du produit. Même parti
 * pris que les embeddings et la génération d'images, câblés en dur sur Gemini pour la même raison
 * (embeddings.ts, providers/geminiImage.ts).
 *
 * Pas de filet `TOOL_CALL_RETRY_NOTE` ici : répondre en texte libre est une issue légitime d'un tour
 * agentique, il n'y a rien à rattraper.
 */
export async function callAgentic(params: AgenticCallParams): Promise<AgenticResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY est requis pour l'assistant : la boucle agentique n'existe que chez OpenAI, indépendamment de LLM_PROVIDER."
    );
  }
  return callOpenAIAgentic(params);
}

/** Recherche web de la veille d'inspiration (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.2) — OpenAI en dur,
 *  même parti pris que callAgentic : elle ne dépend pas de LLM_PROVIDER. */
export async function callWebResearch(params: WebResearchParams): Promise<WebResearchResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY est requis pour la veille d'inspiration : la recherche web passe par OpenAI, indépendamment de LLM_PROVIDER.");
  }
  return callOpenAIWebResearch(params);
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

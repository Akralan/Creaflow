import OpenAI from "openai";
import type { StructuredCallParams } from "../types";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY n'est pas défini dans l'environnement.");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

// API Responses (/v1/responses), pas Chat Completions : sur les modèles reasoning (famille gpt-5.x),
// Chat Completions refuse explicitement de combiner function tools et raisonnement actif
// ("Function tools with reasoning_effort are not supported... use /v1/responses"). Responses les
// combine nativement. Effort "low" plutôt que "none" : un peu de raisonnement bénéficie à la
// génération de script sans le coût (tokens/latence) d'un effort plus élevé. "minimal" n'existe
// pas pour tous les modèles reasoning — gpt-5.6-luna refuse explicitement cette valeur (supportées :
// none/low/medium/high/xhigh/max) ; "low" est la valeur la plus basse au-dessus de "none" ici.
export async function callOpenAI({ system, userMessage, tool, maxTokens, strict }: StructuredCallParams): Promise<unknown> {
  const response = await getClient().responses.create({
    model: MODEL,
    instructions: system,
    input: userMessage,
    max_output_tokens: maxTokens,
    reasoning: { effort: "low" },
    tools: [
      {
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
        // strict:true (activé au cas par cas par l'appelant, voir StructuredCallParams) fait respecter
        // le schéma par contrainte de décodage côté API (garantie, pas une suggestion) — nécessaire
        // pour generateScript.ts car en mode non strict le modèle omettait `usedExcerpts` malgré
        // `required` (observé en usage réel, docs/SPEC_MATIERE_EDITEUR.md §3).
        strict: strict ?? false,
      },
    ],
    tool_choice: { type: "function", name: tool.name },
  });

  const call = response.output.find(
    (item): item is Extract<typeof item, { type: "function_call" }> => item.type === "function_call"
  );
  if (!call) {
    throw new Error("Le modèle n'a pas renvoyé de réponse structurée.");
  }

  return JSON.parse(call.arguments);
}

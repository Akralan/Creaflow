import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { AgenticCallParams, AgenticResult, AgenticToolCall } from "../types";
import type { StructuredCallParams } from "../types";
import { logger } from "@/lib/logger";

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

/** Garde-fou de volume (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.3) : un retour d'outil peut peser plus
 *  lourd que tout le reste du contexte (un document de matière entier, par exemple). On tronque en
 *  le disant au modèle, plutôt que de laisser gonfler le prompt de chaque tour suivant. */
const MAX_TOOL_OUTPUT_CHARS = 20_000;

function serializeToolOutput(value: unknown): string {
  const raw = JSON.stringify(value ?? null);
  if (raw.length <= MAX_TOOL_OUTPUT_CHARS) return raw;
  return `${raw.slice(0, MAX_TOOL_OUTPUT_CHARS)}… [tronqué : réponse trop volumineuse, affine ta demande]`;
}

const DEFAULT_MAX_TURNS = 8;

/**
 * Boucle agentique (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.2) — seul provider à l'implémenter.
 *
 * Deux différences de fond avec `callOpenAI` : les outils ne sont pas imposés (`tool_choice: "auto"`,
 * répondre en texte est une issue légitime), et l'historique s'accumule d'un tour à l'autre. Les items
 * renvoyés par le modèle sont réinjectés tels quels dans l'`input` du tour suivant — y compris les
 * items de raisonnement, que l'API Responses attend pour conserver le fil sur les modèles reasoning.
 */
export async function callOpenAIAgentic({
  system,
  messages,
  tools,
  maxTokens,
  maxTurns = DEFAULT_MAX_TURNS,
  effort = "low",
  onToolCall,
}: AgenticCallParams): Promise<AgenticResult> {
  const client = getClient();
  const input: ResponseInputItem[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const toolDefinitions = tools.map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
    strict: false,
  }));
  const toolCalls: AgenticToolCall[] = [];

  for (let turn = 1; turn <= maxTurns; turn++) {
    const response = await client.responses.create({
      model: MODEL,
      instructions: system,
      input,
      max_output_tokens: maxTokens,
      reasoning: { effort },
      tools: toolDefinitions,
      tool_choice: "auto",
    });

    const calls = response.output.filter(
      (item): item is Extract<typeof item, { type: "function_call" }> => item.type === "function_call"
    );

    if (calls.length === 0) {
      return { reply: response.output_text ?? "", toolCalls, turns: turn, stoppedAtMaxTurns: false };
    }

    input.push(...(response.output as ResponseInputItem[]));

    for (const call of calls) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(call.arguments);
      } catch {
        // Arguments illisibles : on le dit au modèle plutôt que d'abandonner le tour, il peut rappeler
        // l'outil correctement.
        const failure = { error: "Arguments JSON invalides." };
        toolCalls.push({ name: call.name, input: call.arguments, output: failure, failed: true });
        input.push({ type: "function_call_output", call_id: call.call_id, output: serializeToolOutput(failure) });
        continue;
      }

      try {
        const output = await onToolCall({ name: call.name, input: parsed });
        toolCalls.push({ name: call.name, input: parsed, output });
        input.push({ type: "function_call_output", call_id: call.call_id, output: serializeToolOutput(output) });
      } catch (err) {
        // Un outil qui échoue (droits, cible introuvable, validation) est une information pour le
        // modèle, pas une panne : il peut corriger son appel ou l'expliquer à l'utilisateur.
        const message = err instanceof Error ? err.message : String(err);
        logger.warn("Appel d'outil agentique échoué", { tool: call.name, err: message });
        const failure = { error: message };
        toolCalls.push({ name: call.name, input: parsed, output: failure, failed: true });
        input.push({ type: "function_call_output", call_id: call.call_id, output: serializeToolOutput(failure) });
      }
    }
  }

  // Plafond atteint : un dernier appel SANS outils, pour ne jamais rendre la main sans réponse.
  logger.warn("Boucle agentique interrompue au plafond de tours", { maxTurns, toolCalls: toolCalls.length });
  const closing = await client.responses.create({
    model: MODEL,
    instructions: system,
    input,
    max_output_tokens: maxTokens,
    reasoning: { effort },
    tool_choice: "none",
  });

  return { reply: closing.output_text ?? "", toolCalls, turns: maxTurns, stoppedAtMaxTurns: true };
}

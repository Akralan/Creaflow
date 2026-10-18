import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { AgenticCallParams, AgenticResult, AgenticToolCall, WebResearchParams, WebResearchResult } from "../types";
import type { StructuredCallParams } from "../types";
import { logger } from "@/lib/logger";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in the environment.");
    }
    // A call that gives no answer for three minutes is stuck (seen on long generations): the SDK retries it.
    client = new OpenAI({ apiKey, timeout: 180_000 });
  }
  return client;
}

const MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

// Responses API (/v1/responses), not Chat Completions: on reasoning models (gpt-5.x family),
// Chat Completions explicitly refuses to combine function tools and active reasoning
// ("Function tools with reasoning_effort are not supported... use /v1/responses"). Responses
// combines them natively. Effort "low" rather than "none": a bit of reasoning benefits
// script generation without the cost (tokens/latency) of a higher effort. "minimal" doesn't exist
// for all reasoning models — gpt-5.6-luna explicitly refuses this value (supported:
// none/low/medium/high/xhigh/max); "low" is the lowest value above "none" here.
export async function callOpenAI({ system, userMessage, tool, maxTokens, strict, images }: StructuredCallParams): Promise<unknown> {
  const response = await getClient().responses.create({
    model: MODEL,
    instructions: system,
    input:
      images && images.length > 0
        ? [{ role: "user", content: [{ type: "input_text", text: userMessage }, ...images.map((image_url) => ({ type: "input_image" as const, image_url, detail: "high" as const }))] }]
        : userMessage,
    max_output_tokens: maxTokens,
    reasoning: { effort: "low" },
    tools: [
      {
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
        // strict:true (enabled case by case by the caller, see StructuredCallParams) enforces
        // the schema by decoding constraint on the API side (a guarantee, not a suggestion) — needed
        // for generateScript.ts because in non-strict mode the model omitted `usedExcerpts` despite
        // `required` (seen in real use, docs/SPEC_MATIERE_EDITEUR.md §3).
        strict: strict ?? false,
      },
    ],
    tool_choice: { type: "function", name: tool.name },
  });

  const call = response.output.find(
    (item): item is Extract<typeof item, { type: "function_call" }> => item.type === "function_call"
  );
  if (!call) {
    throw new Error("The model did not return a structured response.");
  }

  return JSON.parse(call.arguments);
}

/**
 * Web search (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.2): `web_search` tool built into the Responses API,
 * executed on OpenAI's side — no loop on our side. Returns the report and the cited pages.
 */
export async function callOpenAIWebResearch({ system, userMessage, maxTokens }: WebResearchParams): Promise<WebResearchResult> {
  const response = await getClient().responses.create({
    model: MODEL,
    instructions: system,
    input: userMessage,
    max_output_tokens: maxTokens,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search", search_context_size: "medium" }],
    // "required" and not "auto": with auto, the model sometimes answered from memory without searching —
    // no page consulted, hence no verifiable link, hence zero cards (seen on the first real try).
    tool_choice: "required",
  });
  const sources: WebResearchResult["sources"] = [];
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type !== "output_text") continue;
      for (const annotation of part.annotations) {
        if (annotation.type === "url_citation") sources.push({ url: annotation.url, title: annotation.title ?? null });
      }
    }
  }
  return { text: response.output_text ?? "", sources };
}

/** Volume guardrail (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.3): a tool return can weigh more
 *  than all the rest of the context (an entire material document, for example). We truncate while
 *  telling the model, rather than letting the prompt of every following turn swell. */
const MAX_TOOL_OUTPUT_CHARS = 20_000;

function serializeToolOutput(value: unknown): string {
  const raw = JSON.stringify(value ?? null);
  if (raw.length <= MAX_TOOL_OUTPUT_CHARS) return raw;
  return `${raw.slice(0, MAX_TOOL_OUTPUT_CHARS)}… [truncated: response too large, narrow your request]`;
}

const DEFAULT_MAX_TURNS = 8;

/**
 * Agentic loop (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.2) — the only provider to implement it.
 *
 * Two fundamental differences with `callOpenAI`: tools are not forced (`tool_choice: "auto"`,
 * answering in text is a legitimate outcome), and the history accumulates from one turn to the next.
 * The items returned by the model are fed back as is into the next turn's `input` — including
 * the reasoning items, which the Responses API expects in order to keep the thread on reasoning models.
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
        // Unreadable arguments: we tell the model rather than abandon the turn, it can call
        // the tool again correctly.
        const failure = { error: "Invalid JSON arguments." };
        toolCalls.push({ name: call.name, input: call.arguments, output: failure, failed: true });
        input.push({ type: "function_call_output", call_id: call.call_id, output: serializeToolOutput(failure) });
        continue;
      }

      try {
        const output = await onToolCall({ name: call.name, input: parsed });
        toolCalls.push({ name: call.name, input: parsed, output });
        input.push({ type: "function_call_output", call_id: call.call_id, output: serializeToolOutput(output) });
      } catch (err) {
        // A tool that fails (permissions, target not found, validation) is information for the
        // model, not an outage: it can fix its call or explain it to the user.
        const message = err instanceof Error ? err.message : String(err);
        logger.warn("Agentic tool call failed", { tool: call.name, err: message });
        const failure = { error: message };
        toolCalls.push({ name: call.name, input: parsed, output: failure, failed: true });
        input.push({ type: "function_call_output", call_id: call.call_id, output: serializeToolOutput(failure) });
      }
    }
  }

  // Cap reached: one last call WITHOUT tools, to never hand back control without a reply.
  logger.warn("Agentic loop interrupted at the turn cap", { maxTurns, toolCalls: toolCalls.length });
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

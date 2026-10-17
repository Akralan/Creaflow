export interface LlmToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
    // Requirement of OpenAI strict mode (src/lib/llm/providers/openai.ts): all properties being
    // already `required`, the schema can be closed so the API guarantees their presence in the output
    // rather than relying on the model's goodwill. Ignored without effect by the other providers.
    additionalProperties?: false;
  };
}

/** A conversation turn, on the caller side — the multi-turn equivalent of the single `userMessage` of
 *  `StructuredCallParams` (docs/SPEC_ASSISTANT_AGENTIQUE.md §2). */
export interface AgenticMessage {
  role: "user" | "assistant";
  content: string;
}

/** A tool call made by the model during the loop, with what we answered. */
export interface AgenticToolCall {
  name: string;
  input: unknown;
  output: unknown;
  /** True when the execution failed and the error was sent back to the model instead of crashing. */
  failed?: boolean;
}

/** Web search (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.2) — OpenAI only, like the agentic loop. */
export interface WebResearchParams {
  system: string;
  userMessage: string;
  maxTokens: number;
}

export interface WebResearchResult {
  /** Report written by the model. */
  text: string;
  /** Pages actually consulted (url_citation annotations) — the only proof that a link isn't made up. */
  sources: Array<{ url: string; title: string | null }>;
}

export interface AgenticResult {
  /** Final conversational reply. Never empty: if the loop reaches `maxTurns`, a last
   *  call without tools forces the model to conclude. */
  reply: string;
  toolCalls: AgenticToolCall[];
  turns: number;
  stoppedAtMaxTurns: boolean;
}

/** Agentic loop — N tools NOT forced, several round trips, tools executed server-side
 *  (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.2). Implemented for the OpenAI provider only:
 *  the caller goes through `callAgentic` (provider.ts), which doesn't consult `LLM_PROVIDER`. */
export interface AgenticCallParams {
  system: string;
  messages: AgenticMessage[];
  tools: LlmToolDefinition[];
  /** Output budget per model call, not for the whole loop. */
  maxTokens: number;
  /** Hard guardrail (§2.3). Default: DEFAULT_MAX_TURNS. */
  maxTurns?: number;
  /** OpenAI reasoning effort. Default: "low", like the rest of the repo. */
  effort?: "low" | "medium" | "high";
  /** Executes a tool call and returns what will be passed to the model (serialized as JSON).
   *  An exception is caught and sent back to the model as an error — it doesn't interrupt the loop. */
  onToolCall: (call: { name: string; input: unknown }) => Promise<unknown>;
}

export interface StructuredCallParams {
  system: string;
  userMessage: string;
  tool: LlmToolDefinition;
  maxTokens: number;
  // OpenAI strict mode only (providers/openai.ts, ignored by the other providers) — the caller
  // enables it explicitly case by case, never by default: it requires `additionalProperties: false`
  // everywhere in `tool.input_schema` (400 otherwise), which only the full script generation tools
  // declare. Enabling it by default broke the micro-edits (`regenerate_hashtags` etc.)
  // whose smaller schemas are not compliant — see docs/SPEC_MATIERE_EDITEUR.md §3.
  strict?: boolean;
}

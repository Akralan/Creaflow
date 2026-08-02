export interface LlmToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface StructuredCallParams {
  system: string;
  userMessage: string;
  tool: LlmToolDefinition;
  maxTokens: number;
}

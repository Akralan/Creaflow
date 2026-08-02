import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { StructuredCallParams } from "../types";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY n'est pas défini dans l'environnement.");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

export async function callAnthropic({ system, userMessage, tool, maxTokens }: StructuredCallParams): Promise<unknown> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    tools: [tool as Tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Le modèle n'a pas renvoyé de réponse structurée.");
  }

  return toolUse.input;
}

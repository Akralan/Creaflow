import { getClaudeClient, CLAUDE_MODEL } from "./client";
import { generateScriptTool, generatedScriptSchema, GENERATE_SCRIPT_TOOL_NAME, type GeneratedScript } from "./scriptSchema";
import { SCRIPT_SYSTEM_PROMPT, buildScriptUserMessage, type ScriptGenerationContext } from "./prompts";

export async function generateScript(context: ScriptGenerationContext): Promise<GeneratedScript> {
  const client = getClaudeClient();

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: SCRIPT_SYSTEM_PROMPT,
    tools: [generateScriptTool],
    tool_choice: { type: "tool", name: GENERATE_SCRIPT_TOOL_NAME },
    messages: [{ role: "user", content: buildScriptUserMessage(context) }],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Claude n'a pas renvoyé de script structuré.");
  }

  return generatedScriptSchema.parse(toolUse.input);
}

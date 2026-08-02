import { callStructured } from "./provider";
import {
  toolForContentType,
  videoScriptSchema,
  visualScriptSchema,
  textScriptSchema,
  type GeneratedScript,
} from "./scriptSchema";
import { SCRIPT_SYSTEM_PROMPT, buildScriptUserMessage, type ScriptGenerationContext } from "./prompts";

export async function generateScript(context: ScriptGenerationContext): Promise<GeneratedScript> {
  const args = await callStructured({
    system: SCRIPT_SYSTEM_PROMPT,
    userMessage: buildScriptUserMessage(context),
    tool: toolForContentType(context.contentType),
    maxTokens: 2048,
  });

  if (context.contentType === "video") {
    return { contentType: "video", ...videoScriptSchema.parse(args) };
  }
  if (context.contentType === "visual") {
    return { contentType: "visual", ...visualScriptSchema.parse(args) };
  }
  return { contentType: "text", ...textScriptSchema.parse(args) };
}

import { callStructured } from "./provider";
import {
  toolForContentType,
  videoScriptSchema,
  visualScriptSchema,
  textScriptSchema,
  type GeneratedScript,
} from "./scriptSchema";
import { SCRIPT_SYSTEM_PROMPT, buildScriptUserMessage, type ScriptGenerationContext } from "./prompts";
import { enforceStoryboardCount } from "@/lib/visualDesign/visualFormat";

export async function generateScript(context: ScriptGenerationContext): Promise<GeneratedScript> {
  const userMessage = buildScriptUserMessage(context);
  const call = (message: string) =>
    callStructured({
      system: SCRIPT_SYSTEM_PROMPT,
      userMessage: message,
      tool: toolForContentType(context.contentType),
      maxTokens: 2048,
      // Seul appel du repo à l'activer : son schéma (scriptSchema.ts) est le seul déclaré conforme au
      // mode strict OpenAI (additionalProperties:false partout, cf. StructuredCallParams.strict).
      strict: true,
    });
  const args = await call(userMessage);

  if (context.contentType === "video") {
    return { contentType: "video", ...videoScriptSchema.parse(args) };
  }
  if (context.contentType === "visual") {
    // Le format impose le nombre d'entrées du storyboard (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md
    // §5.1) : un écart vaut un second appel avec rappel ; s'il persiste, on tronque ou on garde —
    // jamais d'échec pour ça.
    let visual = visualScriptSchema.parse(args);
    const first = enforceStoryboardCount(visual.storyboard, context.visual);
    if (!first.ok) {
      const retried = visualScriptSchema.safeParse(await call(`${userMessage}\n\n${first.reminder}`));
      const candidate = retried.success ? retried.data : visual;
      const second = enforceStoryboardCount(candidate.storyboard, context.visual);
      visual = { ...candidate, storyboard: second.storyboard };
    }
    return { contentType: "visual", ...visual };
  }
  return { contentType: "text", ...textScriptSchema.parse(args) };
}

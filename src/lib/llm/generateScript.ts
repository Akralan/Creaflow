import { ZodError } from "zod";
import { callStructured } from "./provider";
import {
  generationPrepSchema,
  toolForContentType,
  visualScriptSchema,
  textScriptSchema,
  type GeneratedScript,
  type GenerationPrep,
} from "./scriptSchema";
import { SCRIPT_SYSTEM_PROMPT, buildScriptUserMessage, type ScriptGenerationContext } from "./prompts";
import { buildRefusalBlock, checkGeneratedPost, type CheckContext } from "./scriptChecks";
import { writeScriptFromEvent } from "./eventWriter";
import { enforceStoryboardCount } from "@/lib/visualDesign/visualFormat";

interface Attempt {
  script: GeneratedScript;
  prep: GenerationPrep | null;
  failures: string[];
}

function parsePost(context: ScriptGenerationContext, args: unknown): GeneratedScript {
  return context.contentType === "visual"
    ? { contentType: "visual", ...visualScriptSchema.parse(args) }
    : { contentType: "text", ...textScriptSchema.parse(args) };
}

function evaluate(script: GeneratedScript, args: unknown, checkContext: CheckContext): Attempt {
  const prepResult = generationPrepSchema.safeParse(args);
  const prep = prepResult.success ? prepResult.data : null;
  return { script, prep, failures: checkGeneratedPost(script, prep, checkContext) };
}

/**
 * Full generation (docs/SPEC_PROMPT_GENERATION_V3.md §3-§5): the model prepares then writes in a
 * single call; the code checks; if a check fails, ONE second attempt receives the error report.
 * We keep the attempt with the fewest failures — never an error for the user because of a
 * check. The storyboard is still brought back within its bounds as before.
 */
export async function generateScript(context: ScriptGenerationContext): Promise<GeneratedScript> {
  // Series with a reader, a form and an event to tell: the per-event writer
  // (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5). The rest of this function is the V3 path.
  if (context.eventBrief) {
    return writeScriptFromEvent({
      brandName: context.creatorProfile.brandName,
      activityType: context.creatorProfile.activityType,
      subjectName: context.product?.name ?? context.creatorProfile.brandName,
      platform: context.platform,
      contentType: context.contentType,
      visual: context.visual,
      styleProfile: context.styleProfile,
      recentPosts: context.recentPosts,
      brief: context.eventBrief,
      language: context.language,
    });
  }

  const userMessage = buildScriptUserMessage(context);
  const call = (message: string) =>
    callStructured({
      system: SCRIPT_SYSTEM_PROMPT,
      userMessage: message,
      tool: toolForContentType(context.contentType),
      maxTokens: 4096,
      // Only call in the repo to enable it: its schema (scriptSchema.ts) is the only one declared
      // compliant with OpenAI strict mode (additionalProperties:false everywhere, see StructuredCallParams.strict).
      strict: true,
    });

  const checkContext: CheckContext = {
    platform: context.platform,
    contentType: context.contentType,
    visual: context.visual,
    materialTexts: (context.materialDocuments ?? []).map((d) => d.annotatedText),
    avoid: context.styleProfile?.avoid ?? [],
    recentPosts: context.recentPosts,
    language: context.language,
  };

  const firstArgs = await call(userMessage);
  // An unreadable first response (missing field, empty storyboard…) gets the same second
  // attempt as a failed check; if the second one is unreadable too, the original error bubbles up.
  let first: Attempt | null = null;
  let firstFailures: string[];
  let parseError: unknown = null;
  try {
    first = evaluate(parsePost(context, firstArgs), firstArgs, checkContext);
    firstFailures = first.failures;
  } catch (err) {
    if (!(err instanceof ZodError)) throw err;
    parseError = err;
    firstFailures = [
      `Your response did not respect the tool's format (${err.issues.map((i) => i.path.join(".") || "root").join(", ")}): return all the required fields.`,
    ];
  }
  let best = first;
  const retried = firstFailures.length > 0;

  if (retried) {
    try {
      const secondArgs = await call(`${userMessage}\n\n${buildRefusalBlock(firstFailures)}`);
      const second = evaluate(parsePost(context, secondArgs), secondArgs, checkContext);
      // On a tie, the second: it read the error report.
      if (!best || second.failures.length <= best.failures.length) best = second;
    } catch (err) {
      // Second attempt unreadable or failed: the first remains valid, if there is one.
      if (!best) throw parseError ?? err;
    }
  }
  if (!best) throw parseError;

  let script = best.script;
  if (script.contentType === "visual") {
    script = { ...script, storyboard: enforceStoryboardCount(script.storyboard, context.visual).storyboard };
  }
  if (!best.prep) return script;
  const inspirationsShown = (context.inspirations ?? []).map((c) => ({ ref: c.ref, id: c.id }));
  return { ...script, trace: { version: 3, ...best.prep, inspirationsShown, checks: { failures: best.failures, retried } } };
}

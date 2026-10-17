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
 * Génération complète (docs/SPEC_PROMPT_GENERATION_V3.md §3-§5) : le modèle prépare puis rédige en un
 * appel ; le code contrôle ; si un contrôle échoue, UNE seconde tentative reçoit le rapport d'erreurs.
 * On garde la tentative qui a le moins d'échecs — jamais d'erreur pour l'utilisateur à cause d'un
 * contrôle. Le storyboard reste ramené dans ses bornes comme avant.
 */
export async function generateScript(context: ScriptGenerationContext): Promise<GeneratedScript> {
  // Série avec lecteur, forme et événement à raconter : le rédacteur par événements
  // (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5). Le reste de cette fonction est le chemin V3.
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
    });
  }

  const userMessage = buildScriptUserMessage(context);
  const call = (message: string) =>
    callStructured({
      system: SCRIPT_SYSTEM_PROMPT,
      userMessage: message,
      tool: toolForContentType(context.contentType),
      maxTokens: 4096,
      // Seul appel du repo à l'activer : son schéma (scriptSchema.ts) est le seul déclaré conforme au
      // mode strict OpenAI (additionalProperties:false partout, cf. StructuredCallParams.strict).
      strict: true,
    });

  const checkContext: CheckContext = {
    platform: context.platform,
    contentType: context.contentType,
    visual: context.visual,
    materialTexts: (context.materialDocuments ?? []).map((d) => d.annotatedText),
    avoid: context.styleProfile?.avoid ?? [],
    recentPosts: context.recentPosts,
  };

  const firstArgs = await call(userMessage);
  // Une première réponse illisible (champ manquant, storyboard vide…) a droit à la même seconde
  // tentative qu'un contrôle raté ; si la seconde l'est aussi, l'erreur d'origine remonte.
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
      `Ta réponse ne respectait pas le format de l'outil (${err.issues.map((i) => i.path.join(".") || "racine").join(", ")}) : renvoie tous les champs requis.`,
    ];
  }
  let best = first;
  const retried = firstFailures.length > 0;

  if (retried) {
    try {
      const secondArgs = await call(`${userMessage}\n\n${buildRefusalBlock(firstFailures)}`);
      const second = evaluate(parsePost(context, secondArgs), secondArgs, checkContext);
      // À égalité, la seconde : elle a lu le rapport d'erreurs.
      if (!best || second.failures.length <= best.failures.length) best = second;
    } catch (err) {
      // Seconde tentative illisible ou en échec : la première reste valable, s'il y en a une.
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

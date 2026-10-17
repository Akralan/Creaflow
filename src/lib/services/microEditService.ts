import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, scriptMicroEditEvents, scripts } from "@/db/schema";
import { callStructured } from "@/lib/llm/provider";
import { SCRIPT_CORE_PROMPT, buildScriptUserMessage } from "@/lib/llm/prompts";
import { buildStyleBlock, parseStoredStyleProfile } from "@/lib/llm/styleProfile";
import { visualSpecFromScript } from "@/lib/visualDesign/visualFormat";
import {
  REWRITE_SELECTION_SYSTEM_PROMPT,
  buildRewriteSelectionUserMessage,
  buildRewriteSelectionTool,
  buildConceptContextLine,
  rewriteSelectionResultSchema,
  toolForBlock,
  parseBlockResult,
  type MicroEditBlock,
} from "@/lib/llm/microEdit";
import { buildGenerationContext, patchScriptContent, type ScriptContentPatch } from "@/lib/services/scriptService";
import { getMaterialForSubject } from "@/lib/services/sourceMaterialService";
import { reconcileCitationsAfterEdit, getCitationsForScript } from "@/lib/services/citationService";
import { ApiError } from "@/lib/api/errors";

export type SelectionBlockField = "title" | "hookVisual" | "hookText" | "caption" | `storyboard.${number}`;

async function loadOwnedScript(userId: string, scriptId: string) {
  const script = await db.query.scripts.findFirst({
    where: and(eq(scripts.id, scriptId), eq(scripts.userId, userId)),
  });
  if (!script) {
    throw new ApiError(404, "Script not found.");
  }
  return script;
}

function replaceOnce(current: string, selectedText: string, replacement: string): string {
  if (!current.includes(selectedText)) {
    throw new ApiError(409, "The selected text no longer matches the current content — reload the script.");
  }
  return current.replace(selectedText, replacement);
}

/** Concaténation des champs texte d'un script pouvant porter une citation (jamais les hashtags, qui
 *  ne citent aucun fait) — sert à repérer les citations devenues obsolètes après une édition
 *  partielle (reconcileCitationsAfterEdit). */
function scriptTextForCitationCheck(script: {
  title: string | null;
  hookVisual: string | null;
  hookText: string | null;
  caption: string | null;
  storyboard: unknown;
}): string {
  const storyboardText = Array.isArray(script.storyboard)
    ? (script.storyboard as { description?: string }[]).map((s) => s.description ?? "").join(" ")
    : "";
  return [script.title, script.hookVisual, script.hookText, script.caption, storyboardText]
    .filter(Boolean)
    .join(" ");
}

/**
 * Sélection → instruction libre → remplacement direct (docs/SPEC_MATIERE_EDITEUR.md §4.4) — le
 * geste principal de l'éditeur, avec undo. Contraint au passage sélectionné, jamais une
 * régénération de structure.
 */
export async function applySelectionInstruction(
  userId: string,
  scriptId: string,
  params: { blockField: SelectionBlockField; selectedText: string; instruction: string }
) {
  const script = await loadOwnedScript(userId, scriptId);

  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  const brandContext = profile
    ? `Brand: ${profile.brandName} (${profile.activityType})`
    : "";
  // La matière du sujet est fournie ici aussi (pas seulement à la génération complète) : sans elle,
  // une instruction comme "base-toi sur le premier run" ou "parle plutôt de X" est impossible à
  // honorer — le modèle n'aurait rien où piocher (docs/SPEC_MATIERE_EDITEUR.md §3).
  const materialDocuments = await getMaterialForSubject(userId, script.productId);

  // Le titre est reconsidéré sur chaque retouche (sauf si c'est déjà lui qu'on retouche — redondant
  // avec rewrittenText dans ce cas) : demandé mais changé seulement si la retouche fait dévier le
  // sujet du post, cf. buildRewriteSelectionTool.
  const includeTitle = params.blockField !== "title";
  const args = await callStructured({
    system: REWRITE_SELECTION_SYSTEM_PROMPT,
    userMessage: buildRewriteSelectionUserMessage({
      brandContext,
      // Les règles de style apprises valent aussi pour une retouche de phrase — avant ce bloc, la
      // sélection→instruction ignorait le profil (docs/SPEC_APPRENTISSAGE_STYLE.md §5.4).
      styleBlock: buildStyleBlock(parseStoredStyleProfile(profile?.styleProfile), script.platform),
      selectedText: params.selectedText,
      instruction: params.instruction,
      currentTitle: includeTitle ? script.title : undefined,
      materialDocuments: materialDocuments.map((d) => ({ id: d.id, title: d.title, annotatedText: d.annotatedText })),
    }),
    tool: buildRewriteSelectionTool(includeTitle),
    maxTokens: 512,
    strict: true,
  });
  const { rewrittenText, usedExcerpts, title } = rewriteSelectionResultSchema.parse(args);

  const patch: ScriptContentPatch = {};
  if (params.blockField.startsWith("storyboard.")) {
    const index = Number(params.blockField.split(".")[1]);
    const storyboard = (script.storyboard as { planNumber: number; description: string }[] | null) ?? [];
    const step = storyboard[index];
    if (!step) {
      throw new ApiError(404, "Shot not found.");
    }
    patch.storyboard = storyboard.map((s, i) =>
      i === index ? { ...s, description: replaceOnce(s.description, params.selectedText, rewrittenText) } : s
    );
  } else {
    const field = params.blockField as Exclude<SelectionBlockField, `storyboard.${number}`>;
    const currentValue = script[field];
    if (typeof currentValue !== "string" || !currentValue) {
      throw new ApiError(400, "Empty field, nothing to edit.");
    }
    (patch as Record<string, string>)[field] = replaceOnce(currentValue, params.selectedText, rewrittenText);
  }
  if (includeTitle && title !== undefined && title !== (script.title ?? "")) {
    patch.title = title;
  }

  const updated = await patchScriptContent(userId, scriptId, patch);
  await db.insert(scriptMicroEditEvents).values({ userId, scriptId, kind: "selection_instruction" });
  // Ne remplace jamais tout le lot de citations (contrairement à une régénération complète) : retire
  // seulement celles dont l'extrait a disparu du texte, ajoute celles rapportées par cette édition.
  await reconcileCitationsAfterEdit(db, userId, scriptId, script.productId, scriptTextForCitationCheck(updated), usedExcerpts);
  // patchScriptContent ne renvoie que les colonnes de `scripts` — sans ceci, le panneau "Matière
  // utilisée" affiche les citations d'avant cette édition tant que la page n'est pas rechargée.
  return { ...updated, citations: await getCitationsForScript(db, scriptId) };
}

/**
 * Régénération d'un seul bloc (docs/SPEC_MATIERE_EDITEUR.md §4.3) — remplace le régénérer-tout
 * destructeur. Reconstruit le contexte complet (matière, angle, série...) mais ne demande au LLM
 * que le bloc visé.
 */
export async function regenerateBlock(userId: string, scriptId: string, block: MicroEditBlock) {
  const script = await loadOwnedScript(userId, scriptId);

  if (block === "storyboard" && script.contentType === "text") {
    throw new ApiError(400, "No storyboard for a text script.");
  }

  const context = await buildGenerationContext(
    userId,
    script.platform,
    script.contentCategoryId,
    script.contentType,
    script.productId,
    scriptId,
    script.seriesId,
    undefined,
    undefined,
    undefined,
    visualSpecFromScript(script)
  );

  // Pour un post texte, l'accroche EST la première phrase du texte actuel — donné ci-dessous comme
  // référence fixe, jamais réécrit par ce geste (le vrai geste d'édition du texte, c'est
  // sélection→instruction, petit bout par petit bout). Le titre suit aussi, mais seulement si
  // nécessaire : l'outil peut renvoyer le titre actuel inchangé (cf. toolForBlock, champ `required`
  // mais valeur libre) — pas de génération à l'aveugle du contexte général comme avant, qui ignorait
  // complètement ce qui était déjà écrit.
  if (block === "hook" && script.contentType === "text") {
    const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
    const brandContext = profile
      ? `Brand: ${profile.brandName} (${profile.activityType})`
      : "";
    const args = await callStructured({
      system:
        "You are a writer who adjusts the hook and, if needed, the title of an existing post for Tellovo, without ever rewriting the text itself — supplied below as a fixed reference.\n\nYou must NEVER invent factual information that does not appear in this text. Write in English.",
      userMessage: [
        brandContext,
        buildStyleBlock(parseStoredStyleProfile(profile?.styleProfile), script.platform),
        `Current title: ${script.title ?? "(untitled)"}`,
        `Current post text (fixed reference, do not modify):\n${script.caption}`,
        buildConceptContextLine(script.concept),
      ]
        .filter(Boolean)
        .join("\n\n"),
      tool: toolForBlock("hook", "text"),
      maxTokens: 512,
      strict: true,
    });
    const patch = parseBlockResult("hook", args) as ScriptContentPatch;
    const updated = await patchScriptContent(userId, scriptId, patch);
    await db.insert(scriptMicroEditEvents).values({ userId, scriptId, kind: "block_regenerate" });
    // Ce geste ne touche jamais les citations, mais patchScriptContent ne les renvoie pas non plus —
    // sans ceci le front perdrait la liste affichée au premier merge (clé absente de la réponse).
    return { ...updated, citations: await getCitationsForScript(db, scriptId) };
  }

  const args = await callStructured({
    // Le cœur seul : la méthode en étapes suppose les champs de préparation, que les outils de bloc
    // n'ont pas (docs/SPEC_PROMPT_GENERATION_V3.md §4.1).
    system: `${SCRIPT_CORE_PROMPT}\n\nYou must regenerate ONLY the requested block via the supplied tool — strictly leave aside the rest of the script, already frozen and not transmitted here.`,
    userMessage: [buildScriptUserMessage(context), buildConceptContextLine(script.concept)].filter(Boolean).join("\n\n"),
    tool: toolForBlock(block, script.contentType),
    maxTokens: 1024,
  });
  const patch = parseBlockResult(block, args) as ScriptContentPatch;

  const updated = await patchScriptContent(userId, scriptId, patch);
  await db.insert(scriptMicroEditEvents).values({ userId, scriptId, kind: "block_regenerate" });
  return { ...updated, citations: await getCitationsForScript(db, scriptId) };
}

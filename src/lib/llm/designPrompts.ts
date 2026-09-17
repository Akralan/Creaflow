import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { designFontNames } from "@/lib/visualDesign/fonts";
import { DesignValidationError, MAX_LAYERS_PER_SLIDE, sanitizeSlideHtml } from "@/lib/visualDesign/htmlSanitizer";
import { describeTimeline, ENTER_EFFECTS, EXIT_EFFECTS, normalizeTimeline, TimelineValidationError, type Timeline } from "@/lib/visualDesign/timeline";
import type { VerticalId } from "@/lib/verticals/types";

/**
 * Composition et révision d'une maquette (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md Annexe A). Un seul
 * tool, deux messages. Toute sortie repasse par la liste blanche ; en cas de refus, un second appel
 * reçoit le rapport d'erreurs — même esprit que la seconde tentative de callStructured.
 */

export const DESIGN_TOOL_NAME = "design_visual_post";

export const designThemeSchema = z.object({
  palette: z.array(z.string().trim().min(1)).min(2).max(6),
  fontHeading: z.string().min(1),
  fontBody: z.string().min(1),
  mood: z.string().min(1),
});
export type DesignTheme = z.infer<typeof designThemeSchema>;

export const designSlideOutputSchema = z.object({
  planNumber: z.number().int().positive(),
  html: z.string().min(1),
});

export const designResultSchema = z.object({
  theme: designThemeSchema,
  slides: z.array(designSlideOutputSchema).min(1).max(12),
  // Animation seulement (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md Annexe A.3) ; vide sinon.
  timeline: z.array(z.unknown()).default([]),
  rationale: z.string().min(1),
});
export type DesignResult = z.infer<typeof designResultSchema>;

export const designVisualPostTool: LlmToolDefinition = {
  name: DESIGN_TOOL_NAME,
  description: "Compose la maquette d'un post visuel : un thème commun et une slide HTML par entrée du storyboard.",
  input_schema: {
    type: "object",
    properties: {
      theme: {
        type: "object",
        description: "Thème commun à toutes les slides.",
        properties: {
          palette: { type: "array", description: "3 à 5 couleurs hex, la première dominante.", items: { type: "string" } },
          fontHeading: { type: "string", description: "Police des titres, prise dans la liste autorisée." },
          fontBody: { type: "string", description: "Police du texte courant, prise dans la liste autorisée." },
          mood: { type: "string", description: "L'ambiance en quelques mots (ex. « chaleureux, artisanal, contrasté »)." },
        },
        required: ["palette", "fontHeading", "fontBody", "mood"],
        additionalProperties: false,
      },
      slides: {
        type: "array",
        description:
          "Une entrée par slide du storyboard, dans l'ordre. html = un unique <div> racine de la taille exacte du canevas, dont chaque enfant direct est un CALQUE position:absolute avec data-layer (identifiant court unique) et data-type (text | image | shape). Styles inline uniquement.",
        items: {
          type: "object",
          properties: {
            planNumber: { type: "integer" },
            html: { type: "string" },
          },
          required: ["planNumber", "html"],
          additionalProperties: false,
        },
      },
      timeline: {
        type: "array",
        description:
          "Uniquement pour une ANIMATION : une entrée par calque qui apparaît ou disparaît { layerId, enter, startMs, enterMs, exit, exitAtMs }. Un calque absent est visible du début à la fin. Tableau vide pour une maquette statique.",
        items: {
          type: "object",
          properties: {
            layerId: { type: "string" },
            enter: { type: "string", description: `Un de : ${ENTER_EFFECTS.join(", ")}.` },
            startMs: { type: "integer" },
            enterMs: { type: "integer", description: "Durée de l'entrée, 300 à 800 ms." },
            exit: { type: ["string", "null"], description: `Un de : ${EXIT_EFFECTS.join(", ")}, ou null si le calque reste jusqu'à la fin.` },
            exitAtMs: { type: ["integer", "null"] },
          },
          required: ["layerId", "enter", "startMs", "enterMs", "exit", "exitAtMs"],
          additionalProperties: false,
        },
      },
      rationale: { type: "string", description: "2 phrases : le parti pris de composition et pourquoi il sert l'idée du post." },
    },
    required: ["theme", "slides", "timeline", "rationale"],
    additionalProperties: false,
  },
};

const VERTICAL_HINTS: Record<VerticalId, string> = {
  creator: "",
  dev: "- Public développeur : les cartes de code (police JetBrains Mono, white-space:pre, fond sombre), les avant/après, les chiffres et les schémas en blocs fonctionnent bien. Sobre, lisible, pas de décoration gratuite.",
  artisan:
    "- Artisan : la photo du produit est le sujet, le texte la sert (nom, prix, appel à l'action). Ne recouvre jamais l'objet lui-même ; place le texte sur les zones calmes de l'image.",
  entrepreneur: "- Entrepreneur : hiérarchie nette, un message par slide, couleurs de marque, appel à l'action explicite sur la dernière slide.",
};

export interface DesignPromptContext {
  width: number;
  height: number;
  hasLogo: boolean;
  brandKitDescription: string;
  vertical: VerticalId;
  /** Animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md) : durée totale ; null pour une maquette statique. */
  animationDurationMs?: number | null;
}

export function buildDesignSystemPrompt(ctx: DesignPromptContext): string {
  const hint = VERTICAL_HINTS[ctx.vertical];
  return `Tu es directeur artistique pour les réseaux sociaux. Tu composes des maquettes en HTML avec styles inline, destinées à être rendues telles quelles en image.
Contraintes absolues :
- Canevas : ${ctx.width}×${ctx.height} px. Racine unique : <div style="position:relative;width:${ctx.width}px;height:${ctx.height}px;overflow:hidden">.
- Chaque enfant direct de la racine est un CALQUE : position:absolute, top/left/width/height en px, attributs data-layer="l1" (unique) et data-type="text" | "image" | "shape". Au plus ${MAX_LAYERS_PER_SLIDE} calques par slide. Flexbox autorisé À L'INTÉRIEUR d'un calque.
- Balises autorisées : div, span, p, h1-h4, strong, em, br, img. Rien d'autre. Pas de <style>, pas de classes, pas d'événements.
- Images : uniquement src="{{BASE_IMAGE}}"${ctx.hasLogo ? ' ou src="{{LOGO}}"' : ""}. Aucune autre URL, aucun url() en CSS. Fonds unis et linear-gradient autorisés.
- Polices : uniquement ${designFontNames().join(", ")}. Pas d'import.
- Marge de sécurité : rien d'important à moins de 5 % des bords.
- Lisibilité : contraste fort entre texte et fond (voile sombre ou clair sur la photo si nécessaire), une hiérarchie nette (un titre, un sous-texte, éventuellement un détail), jamais plus de 3 tailles de police par slide.
- Les mots viennent du storyboard fourni : tu choisis QUOI afficher et COMMENT, tu n'inventes pas de contenu et tu ne reformules pas le fond.
- Cohérence : même thème, mêmes polices, même logique de placement sur toutes les slides d'un carrousel ; la dernière slide porte l'appel à l'action si le storyboard en a un.
${ctx.brandKitDescription ? `- Identité de marque à respecter : ${ctx.brandKitDescription}.` : "- Pas d'identité de marque définie : compose une palette à partir de la description de l'image et du ton de la marque."}
${hint}
${ctx.animationDurationMs ? buildAnimationParagraph(ctx.animationDurationMs) : ""}`.trim();
}

/** Paragraphe ANIMATION du system prompt (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md Annexe A.2). */
export function buildAnimationParagraph(durationMs: number): string {
  return `ANIMATION : cette maquette est une animation de ${durationMs} ms sur UNE SEULE slide (renvoie exactement une slide). En plus du HTML, renvoie \`timeline\` : une entrée par calque qui apparaît ou disparaît, { layerId, enter: ${ENTER_EFFECTS.map((e) => `"${e}"`).join(" | ")}, startMs, enterMs (300 à 800), exit: ${EXIT_EFFECTS.map((e) => `"${e}"`).join(" | ")} ou null, exitAtMs ou null }.
Règles : chaque moment du storyboard devient un ou plusieurs calques texte rattachés à ce moment, dans l'ordre ; les moments se succèdent (un moment sort avant ou au plus 500 ms après l'entrée du suivant) ; le dernier moment reste jusqu'à la fin ; jamais plus de 2 calques qui entrent en même temps ; le fond et l'image de base ne sont pas dans la timeline (visibles tout du long), sauf un léger zoom-in sur l'image si cela sert le rythme ; typewriter seulement sur un calque texte court.`;
}

export interface DesignPostContext {
  platform: string;
  title: string | null;
  hookVisual: string | null;
  storyboard: { planNumber: number; description: string }[];
  brandName: string;
  tone: string | null;
  baseDescription: string | null;
  baseOrientation: string | null;
}

export function buildDesignCreateMessage(ctx: DesignPostContext, format: { width: number; height: number; animationDurationMs?: number | null }): string {
  const storyboard = ctx.storyboard
    .map((s) => (format.animationDurationMs ? `Moment ${s.planNumber} : ${s.description}` : `${s.planNumber}. ${s.description}`))
    .join("\n");
  const base =
    ctx.baseDescription === null
      ? "Aucune : composition typographique."
      : `Description : ${ctx.baseDescription}${ctx.baseOrientation ? ` · Orientation : ${ctx.baseOrientation}` : ""}`;
  const formatLine = format.animationDurationMs
    ? `Plateforme : ${ctx.platform} · Format : ${format.width}×${format.height} · ANIMATION de ${format.animationDurationMs} ms sur une seule slide`
    : `Plateforme : ${ctx.platform} · Format : ${format.width}×${format.height}`;
  return [
    `=== POST ===\n${formatLine}\nTitre : ${ctx.title ?? "(sans titre)"}\nAccroche visuelle : ${ctx.hookVisual ?? "(aucune)"}\n${format.animationDurationMs ? "Moments du texte, dans l'ordre" : "Storyboard"} :\n${storyboard}`,
    `=== MARQUE ===\nNom : ${ctx.brandName}${ctx.tone ? ` · Ton : ${ctx.tone}` : ""}`,
    `=== IMAGE DE BASE ===\n${base}`,
  ].join("\n\n");
}

export function buildDesignReviseMessage(params: {
  instruction: string;
  planNumber: number | null;
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
  timeline?: Timeline | null;
  durationMs?: number | null;
}): string {
  const slides = params.slides.map((s) => `--- slide ${s.planNumber} ---\n${s.html}`).join("\n");
  const timelineSection =
    params.timeline && params.durationMs
      ? `=== LIGNE DE TEMPS ACTUELLE (${params.durationMs} ms) ===\n${describeTimeline(params.timeline)}\nRenvoie la ligne de temps complète révisée (les calques non concernés inchangés).`
      : null;
  return [
    `=== INSTRUCTION DE L'AUTEUR ===\n${params.instruction}\nPortée : ${params.planNumber ? `slide ${params.planNumber} uniquement` : "toutes les slides"}`,
    `=== THÈME (à conserver sauf si l'instruction le change) ===\n${JSON.stringify(params.theme)}`,
    timelineSection,
    `=== HTML ACTUEL ===\n${slides}\nRenvoie TOUTES les slides (les slides hors portée strictement inchangées). Conserve les data-layer existants quand le calque subsiste : l'auteur a pu le retoucher à la main.`,
  ]
    .filter((s): s is string => Boolean(s))
    .join("\n\n");
}

export interface SanitizedDesignResult {
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
  /** Null pour une maquette statique. */
  timeline: Timeline | null;
  rationale: string;
}

function sanitizeResult(raw: unknown, options: { width: number; height: number; hasLogo: boolean; animationDurationMs?: number | null }): SanitizedDesignResult {
  const parsed = designResultSchema.parse(raw);
  const issues: string[] = [];
  const layerIdsBySlide = new Map<number, string[]>();
  const slides = parsed.slides.map((slide) => {
    try {
      const sanitized = sanitizeSlideHtml(slide.html, options);
      layerIdsBySlide.set(slide.planNumber, sanitized.layerIds);
      return { planNumber: slide.planNumber, html: sanitized.html };
    } catch (err) {
      if (err instanceof DesignValidationError) {
        issues.push(...err.issues.map((i) => `slide ${slide.planNumber} : ${i}`));
        return { planNumber: slide.planNumber, html: "" };
      }
      throw err;
    }
  });
  let timeline: Timeline | null = null;
  if (options.animationDurationMs) {
    if (slides.length !== 1) issues.push(`une animation tient sur UNE slide, ${slides.length} renvoyées`);
    else {
      try {
        timeline = normalizeTimeline(parsed.timeline, layerIdsBySlide.get(slides[0].planNumber) ?? [], options.animationDurationMs);
        if (timeline.length === 0) issues.push("ligne de temps vide : au moins un calque doit apparaître");
      } catch (err) {
        if (err instanceof TimelineValidationError) issues.push(...err.issues.map((i) => `ligne de temps : ${i}`));
        else throw err;
      }
    }
  }
  if (issues.length > 0) throw new DesignValidationError(issues);
  return { theme: parsed.theme, slides, timeline, rationale: parsed.rationale };
}

/** Appel + liste blanche, avec une seconde tentative nourrie du rapport d'erreurs. */
async function callDesignTool(
  system: string,
  userMessage: string,
  options: { width: number; height: number; hasLogo: boolean; animationDurationMs?: number | null }
): Promise<SanitizedDesignResult> {
  const first = await callStructured({ system, userMessage, tool: designVisualPostTool, maxTokens: 8192 });
  try {
    return sanitizeResult(first, options);
  } catch (err) {
    if (!(err instanceof DesignValidationError)) throw err;
    const retryMessage = `${userMessage}\n\n=== TA PRÉCÉDENTE RÉPONSE A ÉTÉ REFUSÉE ===\n${err.issues.map((i) => `- ${i}`).join("\n")}\nCorrige ces points et renvoie la maquette complète.`;
    const second = await callStructured({ system, userMessage: retryMessage, tool: designVisualPostTool, maxTokens: 8192 });
    return sanitizeResult(second, options);
  }
}

export async function composeDesign(params: {
  prompt: DesignPromptContext;
  post: DesignPostContext;
}): Promise<SanitizedDesignResult> {
  const { width, height, hasLogo, animationDurationMs } = params.prompt;
  return callDesignTool(buildDesignSystemPrompt(params.prompt), buildDesignCreateMessage(params.post, { width, height, animationDurationMs }), {
    width,
    height,
    hasLogo,
    animationDurationMs,
  });
}

export async function reviseDesign(params: {
  prompt: DesignPromptContext;
  instruction: string;
  planNumber: number | null;
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
  timeline?: Timeline | null;
}): Promise<SanitizedDesignResult> {
  const { width, height, hasLogo, animationDurationMs } = params.prompt;
  return callDesignTool(
    buildDesignSystemPrompt(params.prompt),
    buildDesignReviseMessage({ ...params, durationMs: animationDurationMs ?? null }),
    { width, height, hasLogo, animationDurationMs }
  );
}

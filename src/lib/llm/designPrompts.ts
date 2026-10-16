import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { designFontNames } from "@/lib/visualDesign/fonts";
import { DesignValidationError, MAX_LAYERS_PER_SLIDE, sanitizeSlideHtml } from "@/lib/visualDesign/htmlSanitizer";
import { DESIGN_IMAGE_VARIANTS, type DesignImageVariant } from "@/lib/visualDesign/designImages";
import { describeTimeline, ENTER_EFFECTS, EXIT_EFFECTS, normalizeTimeline, TimelineValidationError, type Timeline } from "@/lib/visualDesign/timeline";
import { describeUiElementsForPrompt } from "@/lib/visualDesign/uiElements";
import type { VerticalId } from "@/lib/verticals/types";

/**
 * Composition et révision d'une maquette (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md Annexe A, complétée par
 * docs/SPEC_COMPOSITION_VISUELLE.md Annexe A : photos multiples, détourage, montages, éléments
 * d'interface). Un seul tool, deux messages. Toute sortie repasse par la liste blanche ; en cas de
 * refus, un second appel reçoit le rapport d'erreurs — même esprit que la seconde tentative de
 * callStructured.
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
  // Photos utilisées et leur variante (docs/SPEC_COMPOSITION_VISUELLE.md Annexe A.3) ; vide si aucune.
  images: z.array(z.object({ ref: z.string(), variant: z.string() })).default([]),
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
      images: {
        type: "array",
        description:
          "Les photos effectivement utilisées dans les slides, parmi celles listées, avec leur variante : \"original\" (photo entière) ou \"cutout\" (sujet détouré sur fond transparent, seulement si le détourage est disponible pour cette photo). Une photo non listée ici ne doit pas apparaître dans le HTML. Tableau vide sans photo.",
        items: {
          type: "object",
          properties: {
            ref: { type: "string", description: "Référence de la photo (p1, p2…)." },
            variant: { type: "string", description: `Un de : ${DESIGN_IMAGE_VARIANTS.join(", ")}.` },
          },
          required: ["ref", "variant"],
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
    required: ["theme", "slides", "images", "timeline", "rationale"],
    additionalProperties: false,
  },
};

const VERTICAL_HINTS: Record<VerticalId, string> = {
  creator: "",
  dev: "- Public développeur : les cartes de code (police JetBrains Mono, white-space:pre, fond sombre), les captures d'écran dans un cadre de navigateur ou de téléphone, les avant/après côte à côte, les chiffres et les schémas en blocs fonctionnent bien. Sobre, lisible, pas de décoration gratuite.",
  artisan:
    "- Artisan : la photo du produit est le sujet, le texte la sert (nom, prix, appel à l'action). Un produit détouré centré sur un fond de marque avec une étiquette de prix est souvent la meilleure première slide. Ne recouvre jamais l'objet lui-même ; place le texte sur les zones calmes de l'image.",
  entrepreneur: "- Entrepreneur : hiérarchie nette, un message par slide, couleurs de marque, appel à l'action explicite sur la dernière slide.",
};

/** Une photo mise à disposition de l'agent (docs/SPEC_COMPOSITION_VISUELLE.md Annexe A.1). */
export interface DesignImageContext {
  ref: string;
  description: string;
  orientation: string | null;
  productName: string | null;
  cutoutAvailable: boolean;
}

export interface DesignPromptContext {
  width: number;
  height: number;
  hasLogo: boolean;
  brandKitDescription: string;
  vertical: VerticalId;
  /** Photos déclarées sur la maquette ; vide pour une composition typographique. */
  images: DesignImageContext[];
  /** Animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md) : durée totale ; null pour une maquette statique. */
  animationDurationMs?: number | null;
}

function buildPhotosRule(ctx: DesignPromptContext): string {
  if (ctx.images.length === 0) {
    return `- Images : ${ctx.hasLogo ? 'uniquement src="{{LOGO}}"' : "aucune (aucune photo fournie, pas de logo)"}. Aucune URL, aucun url() en CSS. Fonds unis et gradients autorisés.`;
  }
  const refs = ctx.images.map((i) => `"{{IMG:${i.ref}}}"`).join(", ");
  const anyCutout = ctx.images.some((i) => i.cutoutAvailable);
  return [
    `- Photos : uniquement src=${refs} parmi les photos listées${ctx.hasLogo ? ', et src="{{LOGO}}"' : ""}. Aucune autre URL, aucun url() en CSS. Chaque photo utilisée est déclarée dans \`images\` avec sa variante : "original" (photo entière, object-fit:cover)${anyCutout ? ' ou "cutout" (sujet détouré sur fond transparent — seulement pour une photo marquée « détourage disponible » ; pose-le sur un fond uni ou un gradient avec une ombre portée, jamais sur une autre photo chargée)' : ""}. Une photo peut rester inutilisée.`,
    "- Montages, un motif par slide : produit détouré centré sur fond de marque avec ombre portée ; deux photos côte à côte (avant / après) ; grille 2×2 ; photo pleine page + médaillon rond (clip-path:circle(50% at 50% 50%)) ; collage décalé avec légère rotation (transform:rotate). Une photo dominante par slide, les autres en appui ; jamais plus de 3 photos sur une slide.",
  ].join("\n");
}

export function buildDesignSystemPrompt(ctx: DesignPromptContext): string {
  const hint = VERTICAL_HINTS[ctx.vertical];
  return `Tu es directeur artistique pour les réseaux sociaux. Tu composes des maquettes en HTML avec styles inline, destinées à être rendues telles quelles en image, à partir des VRAIES photos de la marque : tu ne décris jamais une image à générer, tu assembles.
Contraintes absolues :
- Canevas : ${ctx.width}×${ctx.height} px. Racine unique : <div style="position:relative;width:${ctx.width}px;height:${ctx.height}px;overflow:hidden">.
- Chaque enfant direct de la racine est un CALQUE : position:absolute, top/left/width/height en px, attributs data-layer="l1" (unique) et data-type="text" | "image" | "shape". Au plus ${MAX_LAYERS_PER_SLIDE} calques par slide. Flexbox autorisé À L'INTÉRIEUR d'un calque.
- Balises autorisées : div, span, p, h1-h4, strong, em, br, img. Rien d'autre. Pas de <style>, pas de classes, pas d'événements.
${buildPhotosRule(ctx)}
- Éléments d'interface (calques shape ou text faits de div + styles) : ${describeUiElementsForPrompt()}. Utilise-les quand ils servent le message, jamais pour décorer.
- Polices : uniquement ${designFontNames().join(", ")}. Pas d'import.
- Marge de sécurité : rien d'important à moins de 5 % des bords.
- Lisibilité : contraste fort entre texte et fond (voile sombre ou clair sur la photo si nécessaire), une hiérarchie nette (un titre, un sous-texte, éventuellement un détail), jamais plus de 3 tailles de police par slide.
- Les mots viennent du storyboard fourni : tu choisis QUOI afficher et COMMENT, tu n'inventes pas de contenu et tu ne reformules pas le fond.
- Cohérence : même thème, mêmes polices, même logique de placement sur toutes les slides d'un carrousel ; la dernière slide porte l'appel à l'action si le storyboard en a un.
${ctx.brandKitDescription ? `- Identité de marque à respecter : ${ctx.brandKitDescription}.` : "- Pas d'identité de marque définie : compose une palette à partir de la description des photos et du ton de la marque."}
${hint}
${ctx.animationDurationMs ? buildAnimationParagraph(ctx.animationDurationMs) : ""}`.trim();
}

/** Paragraphe ANIMATION du system prompt (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md Annexe A.2). */
export function buildAnimationParagraph(durationMs: number): string {
  return `ANIMATION : cette maquette est une animation de ${durationMs} ms sur UNE SEULE slide (renvoie exactement une slide). En plus du HTML, renvoie \`timeline\` : une entrée par calque qui apparaît ou disparaît, { layerId, enter: ${ENTER_EFFECTS.map((e) => `"${e}"`).join(" | ")}, startMs, enterMs (300 à 800), exit: ${EXIT_EFFECTS.map((e) => `"${e}"`).join(" | ")} ou null, exitAtMs ou null }.
Règles : chaque moment du storyboard devient un ou plusieurs calques texte rattachés à ce moment, dans l'ordre ; les moments se succèdent (un moment sort avant ou au plus 500 ms après l'entrée du suivant) ; le dernier moment reste jusqu'à la fin ; jamais plus de 2 calques qui entrent en même temps ; le fond et les photos ne sont pas dans la timeline (visibles tout du long), sauf un léger zoom-in sur une photo si cela sert le rythme ; typewriter seulement sur un calque texte court.`;
}

/** Bloc `=== PHOTOS ===` (docs/SPEC_COMPOSITION_VISUELLE.md Annexe A.1), commun à la création et à la révision. */
export function buildPhotosBlock(images: DesignImageContext[]): string {
  if (images.length === 0) return "=== PHOTOS ===\nAucune photo : composition typographique.";
  const lines = images.map((i) =>
    [
      `${i.ref} : ${i.description}`,
      i.orientation,
      i.productName ? `produit : ${i.productName}` : null,
      i.cutoutAvailable ? "détourage disponible" : "détourage non disponible",
    ]
      .filter(Boolean)
      .join(" · ")
  );
  return `=== PHOTOS ===\n${lines.join("\n")}`;
}

export interface DesignPostContext {
  platform: string;
  title: string | null;
  hookVisual: string | null;
  storyboard: { planNumber: number; description: string }[];
  brandName: string;
  /** Ton appris des retouches (styleProfile.tone), null tant qu'aucun style n'a été appris. */
  tone: string | null;
}

export function buildDesignCreateMessage(
  ctx: DesignPostContext,
  images: DesignImageContext[],
  format: { width: number; height: number; animationDurationMs?: number | null }
): string {
  const storyboard = ctx.storyboard
    .map((s) => (format.animationDurationMs ? `Moment ${s.planNumber} : ${s.description}` : `${s.planNumber}. ${s.description}`))
    .join("\n");
  const formatLine = format.animationDurationMs
    ? `Plateforme : ${ctx.platform} · Format : ${format.width}×${format.height} · ANIMATION de ${format.animationDurationMs} ms sur une seule slide`
    : `Plateforme : ${ctx.platform} · Format : ${format.width}×${format.height}`;
  return [
    `=== POST ===\n${formatLine}\nTitre : ${ctx.title ?? "(sans titre)"}\nAccroche visuelle : ${ctx.hookVisual ?? "(aucune)"}\n${format.animationDurationMs ? "Moments du texte, dans l'ordre" : "Storyboard"} :\n${storyboard}`,
    `=== MARQUE ===\nNom : ${ctx.brandName}${ctx.tone ? ` · Ton : ${ctx.tone}` : ""}`,
    buildPhotosBlock(images),
  ].join("\n\n");
}

export function buildDesignReviseMessage(params: {
  instruction: string;
  planNumber: number | null;
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
  images: DesignImageContext[];
  currentVariants: { ref: string; variant: DesignImageVariant }[];
  timeline?: Timeline | null;
  durationMs?: number | null;
}): string {
  const slides = params.slides.map((s) => `--- slide ${s.planNumber} ---\n${s.html}`).join("\n");
  const timelineSection =
    params.timeline && params.durationMs
      ? `=== LIGNE DE TEMPS ACTUELLE (${params.durationMs} ms) ===\n${describeTimeline(params.timeline)}\nRenvoie la ligne de temps complète révisée (les calques non concernés inchangés).`
      : null;
  const variants = params.currentVariants.length > 0 ? `\nVariantes actuelles : ${params.currentVariants.map((v) => `${v.ref} = ${v.variant}`).join(", ")}.` : "";
  return [
    `=== INSTRUCTION DE L'AUTEUR ===\n${params.instruction}\nPortée : ${params.planNumber ? `slide ${params.planNumber} uniquement` : "toutes les slides"}`,
    `=== THÈME (à conserver sauf si l'instruction le change) ===\n${JSON.stringify(params.theme)}`,
    `${buildPhotosBlock(params.images)}${variants}`,
    timelineSection,
    `=== HTML ACTUEL ===\n${slides}\nRenvoie TOUTES les slides (les slides hors portée strictement inchangées) et la liste \`images\` complète. Conserve les data-layer existants quand le calque subsiste : l'auteur a pu le retoucher à la main.`,
  ]
    .filter((s): s is string => Boolean(s))
    .join("\n\n");
}

export interface SanitizedDesignResult {
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
  /** Photos utilisées par au moins une slide, avec la variante retenue. */
  images: { ref: string; variant: DesignImageVariant }[];
  /** Null pour une maquette statique. */
  timeline: Timeline | null;
  rationale: string;
}

interface SanitizeContext {
  width: number;
  height: number;
  hasLogo: boolean;
  images: DesignImageContext[];
  animationDurationMs?: number | null;
}

function sanitizeResult(raw: unknown, options: SanitizeContext): SanitizedDesignResult {
  const parsed = designResultSchema.parse(raw);
  const issues: string[] = [];
  const layerIdsBySlide = new Map<number, string[]>();
  const imageRefs = options.images.map((i) => i.ref);
  const usedRefs = new Set<string>();
  const slides = parsed.slides.map((slide) => {
    try {
      const sanitized = sanitizeSlideHtml(slide.html, { width: options.width, height: options.height, hasLogo: options.hasLogo, imageRefs });
      layerIdsBySlide.set(slide.planNumber, sanitized.layerIds);
      sanitized.imageRefs.forEach((r) => usedRefs.add(r));
      return { planNumber: slide.planNumber, html: sanitized.html };
    } catch (err) {
      if (err instanceof DesignValidationError) {
        issues.push(...err.issues.map((i) => `slide ${slide.planNumber} : ${i}`));
        return { planNumber: slide.planNumber, html: "" };
      }
      throw err;
    }
  });
  // Variantes : celles annoncées par le modèle, ramenées à "original" quand le détourage n'est pas
  // disponible (repli silencieux, docs/SPEC_COMPOSITION_VISUELLE.md §2) ; une photo utilisée dans le
  // HTML mais oubliée de la liste est ajoutée en "original".
  const declared = new Map(parsed.images.map((i) => [i.ref, i.variant]));
  const images = [...usedRefs].map((ref) => {
    const ctx = options.images.find((i) => i.ref === ref);
    const wanted = declared.get(ref);
    const variant: DesignImageVariant = wanted === "cutout" && ctx?.cutoutAvailable ? "cutout" : "original";
    return { ref, variant };
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
  return { theme: parsed.theme, slides, images, timeline, rationale: parsed.rationale };
}

/** Appel + liste blanche, avec une seconde tentative nourrie du rapport d'erreurs. */
async function callDesignTool(system: string, userMessage: string, options: SanitizeContext): Promise<SanitizedDesignResult> {
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

function sanitizeContextOf(prompt: DesignPromptContext): SanitizeContext {
  return { width: prompt.width, height: prompt.height, hasLogo: prompt.hasLogo, images: prompt.images, animationDurationMs: prompt.animationDurationMs };
}

export async function composeDesign(params: { prompt: DesignPromptContext; post: DesignPostContext }): Promise<SanitizedDesignResult> {
  const { width, height, animationDurationMs, images } = params.prompt;
  return callDesignTool(buildDesignSystemPrompt(params.prompt), buildDesignCreateMessage(params.post, images, { width, height, animationDurationMs }), sanitizeContextOf(params.prompt));
}

export async function reviseDesign(params: {
  prompt: DesignPromptContext;
  instruction: string;
  planNumber: number | null;
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
  currentVariants: { ref: string; variant: DesignImageVariant }[];
  timeline?: Timeline | null;
}): Promise<SanitizedDesignResult> {
  return callDesignTool(
    buildDesignSystemPrompt(params.prompt),
    buildDesignReviseMessage({ ...params, images: params.prompt.images, durationMs: params.prompt.animationDurationMs ?? null }),
    sanitizeContextOf(params.prompt)
  );
}

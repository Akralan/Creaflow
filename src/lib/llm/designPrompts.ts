import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { designFontNames } from "@/lib/visualDesign/fonts";
import { DesignValidationError, MAX_LAYERS_PER_SLIDE, sanitizeSlideHtml } from "@/lib/visualDesign/htmlSanitizer";
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
      rationale: { type: "string", description: "2 phrases : le parti pris de composition et pourquoi il sert l'idée du post." },
    },
    required: ["theme", "slides", "rationale"],
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
${hint}`.trim();
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

export function buildDesignCreateMessage(ctx: DesignPostContext, format: { width: number; height: number }): string {
  const storyboard = ctx.storyboard.map((s) => `${s.planNumber}. ${s.description}`).join("\n");
  const base =
    ctx.baseDescription === null
      ? "Aucune : composition typographique."
      : `Description : ${ctx.baseDescription}${ctx.baseOrientation ? ` · Orientation : ${ctx.baseOrientation}` : ""}`;
  return [
    `=== POST ===\nPlateforme : ${ctx.platform} · Format : ${format.width}×${format.height}\nTitre : ${ctx.title ?? "(sans titre)"}\nAccroche visuelle : ${ctx.hookVisual ?? "(aucune)"}\nStoryboard :\n${storyboard}`,
    `=== MARQUE ===\nNom : ${ctx.brandName}${ctx.tone ? ` · Ton : ${ctx.tone}` : ""}`,
    `=== IMAGE DE BASE ===\n${base}`,
  ].join("\n\n");
}

export function buildDesignReviseMessage(params: {
  instruction: string;
  planNumber: number | null;
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
}): string {
  const slides = params.slides.map((s) => `--- slide ${s.planNumber} ---\n${s.html}`).join("\n");
  return [
    `=== INSTRUCTION DE L'AUTEUR ===\n${params.instruction}\nPortée : ${params.planNumber ? `slide ${params.planNumber} uniquement` : "toutes les slides"}`,
    `=== THÈME (à conserver sauf si l'instruction le change) ===\n${JSON.stringify(params.theme)}`,
    `=== HTML ACTUEL ===\n${slides}\nRenvoie TOUTES les slides (les slides hors portée strictement inchangées). Conserve les data-layer existants quand le calque subsiste : l'auteur a pu le retoucher à la main.`,
  ].join("\n\n");
}

export interface SanitizedDesignResult {
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
  rationale: string;
}

function sanitizeResult(raw: unknown, options: { width: number; height: number; hasLogo: boolean }): SanitizedDesignResult {
  const parsed = designResultSchema.parse(raw);
  const issues: string[] = [];
  const slides = parsed.slides.map((slide) => {
    try {
      return { planNumber: slide.planNumber, html: sanitizeSlideHtml(slide.html, options).html };
    } catch (err) {
      if (err instanceof DesignValidationError) {
        issues.push(...err.issues.map((i) => `slide ${slide.planNumber} : ${i}`));
        return { planNumber: slide.planNumber, html: "" };
      }
      throw err;
    }
  });
  if (issues.length > 0) throw new DesignValidationError(issues);
  return { theme: parsed.theme, slides, rationale: parsed.rationale };
}

/** Appel + liste blanche, avec une seconde tentative nourrie du rapport d'erreurs. */
async function callDesignTool(
  system: string,
  userMessage: string,
  options: { width: number; height: number; hasLogo: boolean }
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
  const { width, height, hasLogo } = params.prompt;
  return callDesignTool(buildDesignSystemPrompt(params.prompt), buildDesignCreateMessage(params.post, { width, height }), {
    width,
    height,
    hasLogo,
  });
}

export async function reviseDesign(params: {
  prompt: DesignPromptContext;
  instruction: string;
  planNumber: number | null;
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
}): Promise<SanitizedDesignResult> {
  const { width, height, hasLogo } = params.prompt;
  return callDesignTool(buildDesignSystemPrompt(params.prompt), buildDesignReviseMessage(params), { width, height, hasLogo });
}

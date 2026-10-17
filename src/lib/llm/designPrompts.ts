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
 * Composition and revision of a mockup (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md Annex A, completed by
 * docs/SPEC_COMPOSITION_VISUELLE.md Annex A: multiple photos, cutout, montages, interface
 * elements). A single tool, two messages. Every output goes back through the whitelist; on
 * refusal, a second call receives the error report — same spirit as callStructured's second attempt.
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
  // Photos used and their variant (docs/SPEC_COMPOSITION_VISUELLE.md Annex A.3); empty if none.
  images: z.array(z.object({ ref: z.string(), variant: z.string() })).default([]),
  // Animation only (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md Annex A.3); empty otherwise.
  timeline: z.array(z.unknown()).default([]),
  // A comment, not a deliverable: a model that omits it must not get the whole mockup refused
  // (seen in real use on an animation, 2026-10-17).
  rationale: z.string().default(""),
});
export type DesignResult = z.infer<typeof designResultSchema>;

export const designVisualPostTool: LlmToolDefinition = {
  name: DESIGN_TOOL_NAME,
  description: "Composes the mockup of a visual post: a common theme and one HTML slide per storyboard entry. All visible text on the slides is in English.",
  input_schema: {
    type: "object",
    properties: {
      theme: {
        type: "object",
        description: "Theme common to all slides.",
        properties: {
          palette: { type: "array", description: "3 to 5 hex colors, the first dominant.", items: { type: "string" } },
          fontHeading: { type: "string", description: "Heading font, taken from the allowed list." },
          fontBody: { type: "string", description: "Body text font, taken from the allowed list." },
          mood: { type: "string", description: "The mood in a few words (e.g. \"warm, artisanal, contrasted\")." },
        },
        required: ["palette", "fontHeading", "fontBody", "mood"],
        additionalProperties: false,
      },
      slides: {
        type: "array",
        description:
          "One entry per storyboard slide, in order. html = a single root <div> of the exact canvas size, each direct child of which is a position:absolute LAYER with data-layer (short unique identifier) and data-type (text | image | shape). Inline styles only.",
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
          "The photos actually used in the slides, among those listed, with their variant: \"original\" (whole photo) or \"cutout\" (subject cut out on a transparent background, only if cutout is available for this photo). A photo not listed here must not appear in the HTML. Empty array without photos.",
        items: {
          type: "object",
          properties: {
            ref: { type: "string", description: "Reference of the photo (p1, p2…)." },
            variant: { type: "string", description: `One of: ${DESIGN_IMAGE_VARIANTS.join(", ")}.` },
          },
          required: ["ref", "variant"],
          additionalProperties: false,
        },
      },
      timeline: {
        type: "array",
        description:
          "Only for an ANIMATION: one entry per layer that appears or disappears { layerId, enter, startMs, enterMs, exit, exitAtMs }. An absent layer is visible from start to end. Empty array for a static mockup.",
        items: {
          type: "object",
          properties: {
            layerId: { type: "string" },
            enter: { type: "string", description: `One of: ${ENTER_EFFECTS.join(", ")}.` },
            startMs: { type: "integer" },
            enterMs: { type: "integer", description: "Duration of the entrance, 300 to 800 ms." },
            exit: { type: ["string", "null"], description: `One of: ${EXIT_EFFECTS.join(", ")}, or null if the layer stays until the end.` },
            exitAtMs: { type: ["integer", "null"] },
          },
          required: ["layerId", "enter", "startMs", "enterMs", "exit", "exitAtMs"],
          additionalProperties: false,
        },
      },
      rationale: { type: "string", description: "2 sentences: the composition choice and why it serves the post's idea." },
    },
    required: ["theme", "slides", "images", "timeline", "rationale"],
    additionalProperties: false,
  },
};

const VERTICAL_HINTS: Record<VerticalId, string> = {
  creator: "",
  dev: "- Developer audience: code cards (JetBrains Mono font, white-space:pre, dark background), screenshots in a browser or phone frame, side-by-side before/afters, numbers and block diagrams work well. Sober, readable, no gratuitous decoration.",
  artisan:
    "- Craftsperson: the product photo is the subject, the text serves it (name, price, call to action). A cut-out product centered on a brand background with a price tag is often the best first slide. Never cover the object itself; put the text on the calm areas of the image.",
  entrepreneur: "- Entrepreneur: clear hierarchy, one message per slide, brand colors, explicit call to action on the last slide.",
};

/** A photo made available to the agent (docs/SPEC_COMPOSITION_VISUELLE.md Annex A.1). */
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
  /** Photos declared on the mockup; empty for a typographic composition. */
  images: DesignImageContext[];
  /** Animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md): total duration; null for a static mockup. */
  animationDurationMs?: number | null;
}

function buildPhotosRule(ctx: DesignPromptContext): string {
  if (ctx.images.length === 0) {
    return `- Images: ${ctx.hasLogo ? 'only src="{{LOGO}}"' : "none (no photo supplied, no logo)"}. No URL, no url() in CSS. Solid backgrounds and gradients allowed.`;
  }
  const refs = ctx.images.map((i) => `"{{IMG:${i.ref}}}"`).join(", ");
  const anyCutout = ctx.images.some((i) => i.cutoutAvailable);
  return [
    `- Photos: only src=${refs} among the listed photos${ctx.hasLogo ? ', and src="{{LOGO}}"' : ""}. No other URL, no url() in CSS. Each photo used is declared in \`images\` with its variant: "original" (whole photo, object-fit:cover)${anyCutout ? ' or "cutout" (subject cut out on a transparent background — only for a photo marked "cutout available"; place it on a solid background or a gradient with a drop shadow, never on another loaded photo)' : ""}. A photo may remain unused.`,
    "- Montages, one pattern per slide: cut-out product centered on a brand background with a drop shadow; two photos side by side (before / after); 2×2 grid; full-page photo + round medallion (clip-path:circle(50% at 50% 50%)); offset collage with a slight rotation (transform:rotate). One dominant photo per slide, the others as support; never more than 3 photos on a slide.",
  ].join("\n");
}

export function buildDesignSystemPrompt(ctx: DesignPromptContext): string {
  const hint = VERTICAL_HINTS[ctx.vertical];
  return `You are an art director for social media. You compose mockups in HTML with inline styles, meant to be rendered as is into an image, from the brand's REAL photos: you never describe an image to generate, you assemble.
Absolute constraints:
- Canvas: ${ctx.width}×${ctx.height} px. Single root: <div style="position:relative;width:${ctx.width}px;height:${ctx.height}px;overflow:hidden">.
- Each direct child of the root is a LAYER: position:absolute, top/left/width/height in px, attributes data-layer="l1" (unique) and data-type="text" | "image" | "shape". At most ${MAX_LAYERS_PER_SLIDE} layers per slide. Flexbox allowed INSIDE a layer.
- Allowed tags: div, span, p, h1-h4, strong, em, br, img. Nothing else. No <style>, no classes, no event handlers.
${buildPhotosRule(ctx)}
- Interface elements (shape or text layers made of div + styles): ${describeUiElementsForPrompt()}. Use them when they serve the message, never to decorate.
- Fonts: only ${designFontNames().join(", ")}. No imports.
- Safe margin: nothing important within 5% of the edges.
- Legibility: strong contrast between text and background (dark or light overlay on the photo if needed), a clear hierarchy (a title, a subtext, possibly a detail), never more than 3 font sizes per slide.
- The words come from the supplied storyboard: you choose WHAT to display and HOW, you don't invent content and you don't rephrase the substance. All visible text is in English.
- Consistency: same theme, same fonts, same placement logic across all slides of a carousel; the last slide carries the call to action if the storyboard has one.
${ctx.brandKitDescription ? `- Brand identity to respect: ${ctx.brandKitDescription}.` : "- No brand identity defined: compose a palette from the photo descriptions and the brand's tone."}
${hint}
${ctx.animationDurationMs ? buildAnimationParagraph(ctx.animationDurationMs) : ""}`.trim();
}

/** ANIMATION paragraph of the system prompt (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md Annex A.2). */
export function buildAnimationParagraph(durationMs: number): string {
  return `ANIMATION: this mockup is a ${durationMs} ms animation on a SINGLE slide (return exactly one slide). In addition to the HTML, return \`timeline\`: one entry per layer that appears or disappears, { layerId, enter: ${ENTER_EFFECTS.map((e) => `"${e}"`).join(" | ")}, startMs, enterMs (300 to 800), exit: ${EXIT_EFFECTS.map((e) => `"${e}"`).join(" | ")} or null, exitAtMs or null }.
Rules: each storyboard moment becomes one or more text layers attached to that moment, in order; moments follow one another (a moment exits before or at most 500 ms after the next one enters); the last moment stays until the end; never more than 2 layers entering at the same time; the background and photos are not in the timeline (visible throughout), except a slight zoom-in on a photo if it serves the rhythm; typewriter only on a short text layer.`;
}

/** `=== PHOTOS ===` block (docs/SPEC_COMPOSITION_VISUELLE.md Annex A.1), shared by creation and revision. */
export function buildPhotosBlock(images: DesignImageContext[]): string {
  if (images.length === 0) return "=== PHOTOS ===\nNo photo: typographic composition.";
  const lines = images.map((i) =>
    [
      `${i.ref}: ${i.description}`,
      i.orientation,
      i.productName ? `product: ${i.productName}` : null,
      i.cutoutAvailable ? "cutout available" : "cutout not available",
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
  /** Tone learned from edits (styleProfile.tone), null until a style has been learned. */
  tone: string | null;
}

export function buildDesignCreateMessage(
  ctx: DesignPostContext,
  images: DesignImageContext[],
  format: { width: number; height: number; animationDurationMs?: number | null }
): string {
  const storyboard = ctx.storyboard
    .map((s) => (format.animationDurationMs ? `Moment ${s.planNumber}: ${s.description}` : `${s.planNumber}. ${s.description}`))
    .join("\n");
  const formatLine = format.animationDurationMs
    ? `Platform: ${ctx.platform} · Format: ${format.width}×${format.height} · ${format.animationDurationMs} ms ANIMATION on a single slide`
    : `Platform: ${ctx.platform} · Format: ${format.width}×${format.height}`;
  return [
    `=== POST ===\n${formatLine}\nTitle: ${ctx.title ?? "(untitled)"}\nVisual hook: ${ctx.hookVisual ?? "(none)"}\n${format.animationDurationMs ? "Text moments, in order" : "Storyboard"}:\n${storyboard}`,
    `=== BRAND ===\nName: ${ctx.brandName}${ctx.tone ? ` · Tone: ${ctx.tone}` : ""}`,
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
      ? `=== CURRENT TIMELINE (${params.durationMs} ms) ===\n${describeTimeline(params.timeline)}\nReturn the complete revised timeline (unaffected layers unchanged).`
      : null;
  const variants = params.currentVariants.length > 0 ? `\nCurrent variants: ${params.currentVariants.map((v) => `${v.ref} = ${v.variant}`).join(", ")}.` : "";
  return [
    `=== AUTHOR'S INSTRUCTION ===\n${params.instruction}\nScope: ${params.planNumber ? `slide ${params.planNumber} only` : "all slides"}`,
    `=== THEME (to keep unless the instruction changes it) ===\n${JSON.stringify(params.theme)}`,
    `${buildPhotosBlock(params.images)}${variants}`,
    timelineSection,
    `=== CURRENT HTML ===\n${slides}\nReturn ALL the slides (slides out of scope strictly unchanged) and the complete \`images\` list. Keep the existing data-layer values when the layer remains: the author may have edited it by hand.`,
  ]
    .filter((s): s is string => Boolean(s))
    .join("\n\n");
}

export interface SanitizedDesignResult {
  theme: DesignTheme;
  slides: { planNumber: number; html: string }[];
  /** Photos used by at least one slide, with the chosen variant. */
  images: { ref: string; variant: DesignImageVariant }[];
  /** Null for a static mockup. */
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
        issues.push(...err.issues.map((i) => `slide ${slide.planNumber}: ${i}`));
        return { planNumber: slide.planNumber, html: "" };
      }
      throw err;
    }
  });
  // Variants: those announced by the model, brought back to "original" when cutout isn't
  // available (silent fallback, docs/SPEC_COMPOSITION_VISUELLE.md §2); a photo used in the
  // HTML but forgotten from the list is added as "original".
  const declared = new Map(parsed.images.map((i) => [i.ref, i.variant]));
  const images = [...usedRefs].map((ref) => {
    const ctx = options.images.find((i) => i.ref === ref);
    const wanted = declared.get(ref);
    const variant: DesignImageVariant = wanted === "cutout" && ctx?.cutoutAvailable ? "cutout" : "original";
    return { ref, variant };
  });
  let timeline: Timeline | null = null;
  if (options.animationDurationMs) {
    if (slides.length !== 1) issues.push(`an animation fits on ONE slide, ${slides.length} returned`);
    else {
      try {
        timeline = normalizeTimeline(parsed.timeline, layerIdsBySlide.get(slides[0].planNumber) ?? [], options.animationDurationMs);
        if (timeline.length === 0) issues.push("empty timeline: at least one layer must appear");
      } catch (err) {
        if (err instanceof TimelineValidationError) issues.push(...err.issues.map((i) => `timeline: ${i}`));
        else throw err;
      }
    }
  }
  if (issues.length > 0) throw new DesignValidationError(issues);
  return { theme: parsed.theme, slides, images, timeline, rationale: parsed.rationale };
}

/** Call + whitelist, with a second attempt fed with the error report. */
async function callDesignTool(system: string, userMessage: string, options: SanitizeContext): Promise<SanitizedDesignResult> {
  const first = await callStructured({ system, userMessage, tool: designVisualPostTool, maxTokens: 8192 });
  try {
    return sanitizeResult(first, options);
  } catch (err) {
    // A malformed response (empty slide, missing field) gets the same second attempt as an
    // HTML refused by the whitelist (seen in real use: an empty 2nd slide on an animation).
    const issues =
      err instanceof DesignValidationError
        ? err.issues
        : err instanceof z.ZodError
          ? err.issues.map((i) => `field ${i.path.join(".") || "root"}: ${i.message}`)
          : null;
    if (!issues) throw err;
    const retryMessage = `${userMessage}\n\n=== YOUR PREVIOUS RESPONSE WAS REJECTED ===\n${issues.map((i) => `- ${i}`).join("\n")}\nFix these points and return the complete mockup.`;
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

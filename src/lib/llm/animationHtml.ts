import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { logger } from "@/lib/logger";
import { MAX_ANIMATION_HTML_BYTES, verifyAnimationHtml } from "@/lib/animationHtml/verify";

/**
 * The animation of a post, written by the model as a free HTML page (docs/SPEC_ANIMATION_HTML_LIBRE.md). Three
 * things matter here: the way of thinking asked before any code (the idea, how to SHOW it, the beats), the rules of
 * a good motion design (§3 of the spec), and the contract that makes the page playable at any instant (§2).
 */

export interface AnimationRequest {
  post: { title: string | null; text: string; platform: string };
  brand: { name: string; tone?: string | null; palette?: string | null };
  width: number;
  height: number;
  durationMs: number;
  /** The closed list of fonts, already loaded in the page. */
  fontNames: string[];
  /** Photos the page may use, as `{{IMG:p1}}`. Empty: shapes, SVG and type only. */
  images?: Array<{ ref: string; description: string }>;
  /** "French", "English"… — default: the language of the post. */
  language?: string | null;
}

const beatSchema = z.object({ fromMs: z.number(), toMs: z.number(), shows: z.string(), motion: z.string() });

export const animationResultSchema = z.object({
  concept: z.string().min(1),
  beats: z.array(beatSchema).min(1),
  html: z.string().min(1),
  rationale: z.string().default(""),
});
export type AnimationDraft = z.infer<typeof animationResultSchema>;

export interface AnimationResult extends AnimationDraft {
  attempts: number;
  /** What the review found wrong in the frames (the page was corrected when it did), empty when nothing. */
  reviewed: string[];
  /** What the rendering test still found after the last attempt: the least bad page is kept rather than none. */
  leftover: string[];
}

const TOOL: LlmToolDefinition = {
  name: "write_animation",
  description: "Writes the animation that goes with a post: the idea, the beats, then the page.",
  input_schema: {
    type: "object",
    properties: {
      // Property order is the mechanism that makes the model decide the idea before it writes code: do not move.
      concept: {
        type: "string",
        description: "The ONE idea of the post and how the animation SHOWS it (what moves, grows, counts, draws or flips to make it felt). Two sentences at most.",
      },
      beats: {
        type: "array",
        description: "The plan over the whole duration: a hook (first 1.5 s), the proof, the payoff held at the end. 3 to 5 beats.",
        items: {
          type: "object",
          properties: {
            fromMs: { type: "integer" },
            toMs: { type: "integer" },
            shows: { type: "string", description: "What is on screen: the dominant element, and the words if any (a few)." },
            motion: { type: "string", description: "What moves and how (entrance, easing, continuous motion)." },
          },
          required: ["fromMs", "toMs", "shows", "motion"],
          additionalProperties: false,
        },
      },
      html: {
        type: "string",
        description: "The fragment that goes INSIDE the stage: <style>, elements, optionally one inline <script>. No <html>, <head> or <body>.",
      },
      rationale: { type: "string", description: "Two sentences: the choice that makes this animation land." },
    },
    required: ["concept", "beats", "html", "rationale"],
    additionalProperties: false,
  },
};

export function buildAnimationSystemPrompt(req: Pick<AnimationRequest, "width" | "height" | "durationMs" | "fontNames" | "images">): string {
  const seconds = Math.round(req.durationMs / 100) / 10;
  const safeTop = Math.round(req.height * 0.14);
  const safeBottom = Math.round(req.height * 0.35);
  const safeSide = Math.round(req.width * 0.06);
  const photos =
    req.images && req.images.length > 0
      ? `Photos you may use: ${req.images.map((i) => `src="{{IMG:${i.ref}}}" (${i.description})`).join("; ")}. Use them only if they serve the idea.`
      : "No photo is supplied: draw with CSS, inline SVG and divs.";
  return `You are a motion designer. You make one short animation — HTML, CSS, SVG and, when needed, a little JavaScript — that goes with a social media post. It is what people see in the feed: it must stop the scroll, make ONE idea land in a few seconds, and be worth replaying. You write the animation yourself; there is no template and no limit on your craft, only the contract at the end.

# How to think (do this first, in the fields \`concept\` and \`beats\`)
1. Find the ONE idea of the post: its single most striking fact, change or contrast — a number, a before/after, a mechanism, a decision.
2. Find how to SHOW it, not tell it. Ask what moves, grows, counts, draws, flips or collides to make this idea felt. Derive the picture from the content: a latency becomes a bar that grows to 600 ms; 33 tracking points become dots appearing on a silhouette; "one repetition in three is missed" becomes three dots of which one fades; a threshold becomes a line that a curve crosses. Words only label what the picture already says.
3. Plan the beats over the ${seconds} seconds: hook, proof, payoff.

# What makes it good
- Structure. HOOK (the first 1.5 s): frame 0 already shows the subject and something is moving at 0 ms — no logo intro, no fade from black, no title card. PROOF: the demonstration. PAYOFF: the key figure or message lands and then HOLDS still for the last 1.5 to 2 seconds (people replay and read the last frame). The last frame has ONE dominant element: the key figure, or the key phrase in large type (at least 90 px), clear of everything else, in the central area; the supporting drawing stays quiet around it. Something visibly changes every 1.5 to 3 seconds.
- Text: almost none. About 10 words in total, plus at most a short signature with the brand name. A beat shows one big figure, one object, or a label of at most 4 words — never a sentence. The key figure is huge (a font-size of at least 200 px on this ${req.width} px wide canvas), labels at least 44 px, and nothing under 30 px (a text under 26 px is refused). No two texts ever overlap, at any instant. Large numerals have a line box taller than their glyphs: set line-height:1 on them and leave room for the label under them. Every word comes from the post and is written in the post's language. Every number on screen is copied from the post (same value, same unit): never compute, round, estimate or invent one (no counter that ends at a value the post does not give, no fraction you derived). A figure may count up or grow only between values the post states.
- Hierarchy: one dominant element per beat, everything else quiet. The most important thing moves first; the rest follows, staggered by 60 to 120 ms. Never more than one focal movement at a time. Continuous ambient motion (a slow spin, a pulse, a float) is welcome when it serves the idea and stays subtle.
- Motion: entrances ease out (cubic-bezier(.16,1,.3,1)), 300 to 700 ms; exits shorter and eased in; linear only for a continuous rotation; a small overshoot (scale up to 1.06, then 1) to make something land; bounce only on beats of 800 ms or more. One family of motion for the whole piece (same easing, same distances). Animate transform and opacity (and stroke-dashoffset to draw a line); avoid animating layout.
- Composition: the canvas is ${req.width}×${req.height} px. Keep what matters in the central area: at least ${safeTop} px from the top, ${safeBottom} px from the bottom, ${safeSide} px from the sides (the apps cover the rest). Text contrast at least 4.5:1. Three to five colors, each with a role; take the brand's palette when it is given, otherwise choose one deliberately (a dark background is fine; a stock gradient is not). Use the whole height of the safe area: the main subject sits around the vertical middle and is large (at least 60% of the width), never a small drawing in a corner; keep generous empty space around it, an 8 px grid, no decoration for its own sake.
- Layout, with care: you cannot see the result while you write, so compute it. Give every element its own area; no two elements overlap unless it is the point (a label on its shape); nothing touches the canvas edges or leaves the safe area; text never sits on a busy picture. Set a color on EVERY text element (the default text color is black, invisible on a dark background) and a background on your root. At 0 ms the screen is already composed: the main subject is drawn and visible, not faded to zero.

# The contract (the page is played in a sealed iframe, and exported frame by frame)
- A <div id="stage"> of exactly ${req.width}×${req.height} px already exists. You write the fragment that goes inside it: <style>, elements, optionally one inline <script>. Never write <html>, <head> or <body>. Create your own root (for example <div id="scene" style="position:absolute;inset:0">) and size everything in px.
- The animation lasts exactly ${req.durationMs} ms and loops. Its final state is held for at least 1500 ms.
- Motion is a function of time. Use CSS @keyframes or element.animate(...) created at load, with animation-fill-mode: both (fill: 'both'), and animation-delay to schedule the beats. Never pause or play them yourself. For what CSS cannot do (a counting number, a computed path), define window.seek = function(ms){ ... }: a PURE function that sets the DOM to the state at time ms (the same ms always gives the same result); the player calls it for every frame. Do NOT use setTimeout, setInterval, requestAnimationFrame, Math.random, Date or performance.now.
- Nothing external: no URL, no @import, no <link>, <iframe>, <img src="http…">; no network, no storage. ${photos}
- Fonts, already loaded, use these names exactly: ${req.fontNames.join(", ")}. For counters use font-variant-numeric: tabular-nums.
- Repeated elements (dots, bars, ticks) are built by a short deterministic loop in the load script, not written out. To draw a line, animate stroke-dashoffset on an SVG path. In SVG, always write fill="none" explicitly on paths that are lines (a missing fill paints them black), and set stroke, stroke-width and stroke-linecap yourself. Keep the whole page under ${Math.round(MAX_ANIMATION_HTML_BYTES / 1000) - 20} KB.

Before answering, check: is the first frame already composed and interesting? Is every text readable (color, contrast) and clear of the other elements? Is the text under about 10 words? Is the key figure huge? Is the end held? Is every word from the post, in its language?`;
}

export function buildAnimationUserMessage(req: AnimationRequest): string {
  return [
    `=== POST ===`,
    `Platform: ${req.post.platform} · Canvas: ${req.width}×${req.height} px · Duration: ${req.durationMs} ms`,
    `Language of the words on screen: ${req.language ?? "the language of the post"}`,
    req.post.title ? `Title: ${req.post.title}` : null,
    "",
    req.post.text,
    "",
    `=== BRAND ===`,
    `Name: ${req.brand.name}${req.brand.tone ? ` · Tone: ${req.brand.tone}` : ""}${req.brand.palette ? ` · Palette: ${req.brand.palette}` : ""}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

export interface RenderOutcome {
  /** Problems found by playing the page (script error, empty frame, nothing moves, end not held…). */
  issues: string[];
  /** Frames of the animation (`data:image/png;base64,…`), in order, for the review. */
  frames: string[];
  /** The instants of those frames, in ms. */
  times: number[];
}

export interface GenerateAnimationOptions {
  /** The rendering test (third layer of the control): plays the page and looks at it. */
  render?: (html: string) => Promise<RenderOutcome>;
  /** The model looks at the frames of its own work and corrects it (default: yes when `render` is given). */
  review?: boolean;
  /** A first attempt plus this many more (default 1). */
  retries?: number;
}

const REVIEW_TOOL: LlmToolDefinition = {
  name: "review_animation",
  description: "Reviews the frames of an animation you wrote; returns the verdict, and a corrected page when something is wrong.",
  input_schema: {
    type: "object",
    properties: {
      problems: {
        type: "array",
        description: "What is wrong in the frames, concretely (which element, at which instant). Empty if nothing is.",
        items: { type: "string" },
      },
      verdict: { type: "string", description: '"ok" when the animation can be published as it is, "fix" when a problem listed must be corrected.' },
      html: { type: "string", description: 'The complete corrected fragment when the verdict is "fix", an empty string when it is "ok".' },
    },
    required: ["problems", "verdict", "html"],
    additionalProperties: false,
  },
};

const REVIEW_SYSTEM = `You are the art director of a motion design studio. You wrote an animation as an HTML fragment; here are frames taken from it, at the instants given, and its code. Look at them as a viewer scrolling a feed would, on a phone.

Judge, in this order:
1. Legibility: every text readable (color and contrast against its background), clear of the other elements, not cut by the canvas edge, inside the safe area (the top and the bottom are covered by the interface of the app).
2. Collisions: elements overlapping by mistake, a label running into a shape, two things competing for the same place.
3. The first frame (0 ms): already composed, the subject visible, not nearly empty.
4. The idea: does the picture SHOW the idea of the post rather than tell it? Is there one dominant element per beat? Is the text minimal (about 10 words in all)?
5. The last frame: does it carry the key message, held and clean?

Be strict about what a viewer would notice at a glance; ignore taste. If something must change, return the complete corrected fragment (same contract as before: no html, head or body tag, no external resource, no timers, no randomness, motion as a function of time) and keep what already works. If the frames are good, answer "ok" and return an empty html.`;

/** Writes the animation, controls it (reading, rendering test), has the model review its own frames, and corrects. */
export async function generateAnimationHtml(req: AnimationRequest, options: GenerateAnimationOptions = {}): Promise<AnimationResult> {
  const system = buildAnimationSystemPrompt(req);
  const message = buildAnimationUserMessage(req);
  const maxAttempts = 1 + (options.retries ?? 1);
  let issues: string[] = [];
  let previous: AnimationDraft | null = null;
  let accepted: { draft: AnimationDraft; attempts: number; outcome: RenderOutcome | null } | null = null;
  // Pages the rendering test refused, kept: a page with one overlap is better than no animation.
  const refused: Array<{ draft: AnimationDraft; attempts: number; outcome: RenderOutcome; issues: string[] }> = [];
  let leftover: string[] = [];

  /** Reading, then rendering: the problems of a page, and what the rendering saw. */
  async function control(html: string): Promise<{ issues: string[]; outcome: RenderOutcome | null }> {
    const report = verifyAnimationHtml(html);
    if (!report.ok || !options.render) return { issues: report.issues, outcome: null };
    const outcome = await options.render(html);
    return { issues: outcome.issues, outcome };
  }

  for (let attempt = 1; attempt <= maxAttempts && !accepted; attempt++) {
    const refusal = issues.map((i) => `- ${i}`).join("\n");
    const userMessage =
      attempt === 1 || issues.length === 0
        ? message
        : `${message}\n\n=== YOUR PREVIOUS ANSWER WAS REFUSED ===\n${refusal}\nFix these points and return the complete animation.${previous ? `\n\nYour previous page, for reference:\n${previous.html}` : ""}`;
    const startedAt = Date.now();
    const args = await callStructured({ system, userMessage, tool: TOOL, maxTokens: 16000 });
    logger.info("Animation written", { attempt, seconds: Math.round((Date.now() - startedAt) / 1000) });
    const parsed = animationResultSchema.safeParse(args);
    if (!parsed.success) {
      issues = parsed.error.issues.map((i) => `field ${i.path.join(".") || "root"}: ${i.message}`);
      logger.warn("Animation answer malformed", { attempt, issues });
      continue;
    }
    previous = parsed.data;
    const checked = await control(parsed.data.html);
    issues = checked.issues;
    if (issues.length === 0) accepted = { draft: parsed.data, attempts: attempt, outcome: checked.outcome };
    else {
      logger.warn("Animation refused", { attempt, issues });
      if (checked.outcome) refused.push({ draft: parsed.data, attempts: attempt, outcome: checked.outcome, issues: [...issues] });
    }
  }
  if (!accepted && refused.length > 0) {
    const best = refused.reduce((a, b) => (b.issues.length < a.issues.length ? b : a));
    accepted = { draft: best.draft, attempts: best.attempts, outcome: best.outcome };
    leftover = best.issues;
  }
  if (!accepted) throw new Error(`The animation could not be made: ${issues.join(" · ")}`);

  // The model sees the frames of its own work, once, and corrects what a viewer would notice.
  if ((options.review ?? Boolean(options.render)) && accepted.outcome && accepted.outcome.frames.length > 0) {
    const { outcome } = accepted;
    const frameList = outcome.times.map((t, i) => `image ${i + 1}: ${(t / 1000).toFixed(1)} s`).join(" · ");
    const reviewStartedAt = Date.now();
    const review = await callStructured({
      system: REVIEW_SYSTEM,
      userMessage: `${message}\n\n=== FRAMES ===\n${frameList}\nCanvas ${req.width}×${req.height} px, ${req.durationMs} ms.\n\n=== YOUR CODE ===\n${accepted.draft.html}`,
      tool: REVIEW_TOOL,
      maxTokens: 16000,
      images: outcome.frames,
    }).catch((error) => {
      logger.warn("Animation review failed", { error: String(error) });
      return null;
    });
    logger.info("Animation reviewed", { seconds: Math.round((Date.now() - reviewStartedAt) / 1000) });
    const verdict = z.object({ problems: z.array(z.string()), verdict: z.string(), html: z.string() }).safeParse(review);
    if (verdict.success && verdict.data.verdict === "fix" && verdict.data.html.trim()) {
      const fixed = await control(verdict.data.html);
      if (fixed.issues.length === 0) return { ...accepted.draft, html: verdict.data.html, attempts: accepted.attempts + 1, reviewed: verdict.data.problems, leftover: [] };
      logger.warn("Corrected animation refused, keeping the first", { issues: fixed.issues });
    }
    return { ...accepted.draft, attempts: accepted.attempts, reviewed: verdict.success ? verdict.data.problems : [], leftover };
  }
  return { ...accepted.draft, attempts: accepted.attempts, reviewed: [], leftover };
}

/**
 * Corrects a page the application's rendering test refused (a text overlaps another, a large text sits where the
 * app covers the screen…): the model gets its page back with the findings, measured in the sealed iframe.
 */
export async function reviseAnimationHtml(req: AnimationRequest, previous: { html: string }, issues: string[]): Promise<AnimationResult> {
  const system = buildAnimationSystemPrompt(req);
  const userMessage = `${buildAnimationUserMessage(req)}\n\n=== THE PAGE YOU WROTE ===\n${previous.html}\n\n=== WHAT THE RENDERING TEST FOUND ===\n${issues.map((i) => `- ${i}`).join("\n")}\nCorrect exactly these points, keep everything that works, and return the complete animation.`;
  const args = await callStructured({ system, userMessage, tool: TOOL, maxTokens: 16000 });
  const parsed = animationResultSchema.parse(args);
  const report = verifyAnimationHtml(parsed.html);
  if (!report.ok) throw new Error(`The corrected animation was refused: ${report.issues.join(" · ")}`);
  return { ...parsed, attempts: 1, reviewed: [], leftover: [] };
}

import type { TimelineEntry } from "@/lib/apiClient";
import { EXIT_MS } from "@/lib/visualDesign/timeline";
import { layerElements } from "./designDom";

/**
 * Aperçu d'une animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §2 « Aperçu ») avec la Web
 * Animations API : une animation par calque, construite depuis la ligne de temps, sur toute la
 * durée (fill both), pilotée par currentTime. Les animations ne touchent qu'à opacity, transform et
 * clip-path — jamais aux styles inline, donc le HTML commité par le canevas reste intact.
 */

type Frame = Record<string, string | number>;

const HIDDEN: Record<TimelineEntry["enter"], Frame> = {
  fade: { opacity: 0, transform: "none" },
  "slide-up": { opacity: 0, transform: "translateY(40px)" },
  "slide-left": { opacity: 0, transform: "translateX(40px)" },
  "zoom-in": { opacity: 0, transform: "scale(0.85)" },
  typewriter: { opacity: 1, clipPath: "inset(0 100% 0 0)" },
};
const VISIBLE: Frame = { opacity: 1, transform: "none", clipPath: "inset(0 0 0 0)" };
const GONE: Record<NonNullable<TimelineEntry["exit"]>, Frame> = {
  fade: { opacity: 0, transform: "none" },
  "slide-down": { opacity: 0, transform: "translateY(40px)" },
  "slide-right": { opacity: 0, transform: "translateX(40px)" },
  none: { opacity: 1, transform: "none" },
};

function frame(base: Frame, offset: number, easing?: string): Keyframe {
  return { ...base, offset: Math.min(1, Math.max(0, offset)), ...(easing ? { easing } : {}) } as Keyframe;
}

/** Keyframes d'un calque sur toute la durée de l'animation. */
export function keyframesFor(entry: TimelineEntry, durationMs: number, textLength = 20): Keyframe[] {
  const hidden = HIDDEN[entry.enter];
  const startOffset = entry.startMs / durationMs;
  const enteredOffset = Math.min(1, (entry.startMs + entry.enterMs) / durationMs);
  const enterEasing = entry.enter === "typewriter" ? `steps(${Math.min(40, Math.max(4, textLength))}, end)` : "cubic-bezier(0.2, 0.8, 0.2, 1)";
  const frames: Keyframe[] = [frame(hidden, 0), frame(hidden, startOffset, enterEasing), frame(VISIBLE, enteredOffset)];
  if (entry.exit && entry.exit !== "none" && entry.exitAtMs !== null) {
    const exitOffset = entry.exitAtMs / durationMs;
    const goneOffset = Math.min(1, (entry.exitAtMs + EXIT_MS) / durationMs);
    frames.push(frame(VISIBLE, exitOffset, "ease-in"), frame(GONE[entry.exit], goneOffset), frame(GONE[entry.exit], 1));
  } else {
    frames.push(frame(VISIBLE, 1));
  }
  return frames;
}

export interface SlideAnimations {
  animations: Animation[];
  seek: (ms: number) => void;
  play: () => void;
  pause: () => void;
  currentTime: () => number;
  cancel: () => void;
}

/** Construit (en pause, à 0) les animations des calques cités par la ligne de temps. */
export function buildSlideAnimations(root: HTMLElement, timeline: TimelineEntry[], durationMs: number): SlideAnimations {
  const layers = new Map(layerElements(root).map((l) => [l.getAttribute("data-layer") ?? "", l]));
  const animations: Animation[] = [];
  for (const entry of timeline) {
    const el = layers.get(entry.layerId);
    if (!el) continue;
    const anim = el.animate(keyframesFor(entry, durationMs, (el.textContent ?? "").trim().length), { duration: durationMs, fill: "both" });
    anim.pause();
    anim.currentTime = 0;
    animations.push(anim);
  }
  return {
    animations,
    seek(ms) {
      const t = Math.min(durationMs, Math.max(0, ms));
      for (const a of animations) a.currentTime = t;
    },
    play() {
      for (const a of animations) a.play();
    },
    pause() {
      for (const a of animations) a.pause();
    },
    currentTime() {
      const t = animations[0]?.currentTime;
      return typeof t === "number" ? t : 0;
    },
    cancel() {
      for (const a of animations) a.cancel();
    },
  };
}

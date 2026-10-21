/**
 * Memory of a subject's latest posts (docs/SPEC_MEMOIRE_ET_VEILLE.md §2): a short card per
 * post, never the full text — the model would copy what it has in front of it. Pure module.
 */

export interface RecentPostCard {
  /** ISO, creation date of the script. */
  createdAt: string;
  platform: string;
  readerLabel: string | null;
  /** The moment told, taken from the V3 preparation; null for an older or manual script. */
  moment: string | null;
  hook: string | null;
  /** Type of the chosen hook (number, confession…), taken from the V3 preparation. */
  hookKind: string | null;
  ending: string | null;
  /** Story post rather than episode (docs/SPEC_FIL_NARRATIF.md §9): the next episode must not
   *  retell it — a checkpoint in particular already summed up a whole stretch. */
  narrativeKind: "origin" | "checkpoint" | "promise" | null;
}

export interface RecentPostSource {
  createdAt: Date;
  platform: string;
  hookText: string | null;
  storyboard: unknown;
  caption: string | null;
  generationTrace: unknown;
}

const MAX_ENDING = 160;

// « vision » reste accepté en lecture : des posts déjà écrits le portent en base (type retiré le 2026-10-21).
const NARRATIVE_KINDS: string[] = ["origin", "vision", "checkpoint", "promise"];

interface TraceShape {
  reader?: { label?: unknown };
  candidateMoments?: Array<{ moment?: unknown }>;
  chosenMoment?: { index?: unknown };
  hookOptions?: Array<{ kind?: unknown }>;
  chosenHook?: { index?: unknown };
  narrativeKind?: unknown;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function picked<T>(list: T[] | undefined, index: unknown): T | undefined {
  return Array.isArray(list) && typeof index === "number" ? list[index] : undefined;
}

/** Last sentence of the text, cut at 160 characters. */
export function lastSentence(caption: string | null): string | null {
  const body = text(caption);
  if (!body) return null;
  const sentences = body.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  const last = sentences[sentences.length - 1] ?? body;
  return last.length > MAX_ENDING ? `${last.slice(0, MAX_ENDING - 1)}…` : last;
}

export function postCardFromScript(script: RecentPostSource): RecentPostCard {
  const trace = (script.generationTrace ?? {}) as TraceShape;
  const firstSlide = Array.isArray(script.storyboard) ? (script.storyboard[0] as { description?: unknown } | undefined)?.description : null;
  return {
    createdAt: script.createdAt.toISOString(),
    platform: script.platform,
    readerLabel: text(trace.reader?.label),
    moment: text(picked(trace.candidateMoments, trace.chosenMoment?.index)?.moment),
    hook: text(script.hookText) ?? text(firstSlide),
    hookKind: text(picked(trace.hookOptions, trace.chosenHook?.index)?.kind)?.toLowerCase() ?? null,
    ending: lastSentence(script.caption),
    narrativeKind: NARRATIVE_KINDS.includes(trace.narrativeKind as string) ? (trace.narrativeKind as RecentPostCard["narrativeKind"]) : null,
  };
}

/** The first 6 words, normalized: two hooks that start the same way repeat each other. */
export function hookOpening(hook: string): string {
  return hook
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(" ");
}

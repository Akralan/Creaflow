/**
 * Mémoire des derniers posts d'un sujet (docs/SPEC_MEMOIRE_ET_VEILLE.md §2) : une fiche courte par
 * post, jamais le texte complet — le modèle recopierait ce qu'il a sous les yeux. Module pur.
 */

export interface RecentPostCard {
  /** ISO, date de création du script. */
  createdAt: string;
  platform: string;
  readerLabel: string | null;
  /** Le moment raconté, tiré de la préparation V3 ; null pour un script plus ancien ou manuel. */
  moment: string | null;
  hook: string | null;
  /** Type de l'accroche retenue (chiffre, aveu…), tiré de la préparation V3. */
  hookKind: string | null;
  ending: string | null;
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

interface TraceShape {
  reader?: { label?: unknown };
  candidateMoments?: Array<{ moment?: unknown }>;
  chosenMoment?: { index?: unknown };
  hookOptions?: Array<{ kind?: unknown }>;
  chosenHook?: { index?: unknown };
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function picked<T>(list: T[] | undefined, index: unknown): T | undefined {
  return Array.isArray(list) && typeof index === "number" ? list[index] : undefined;
}

/** Dernière phrase du texte, coupée à 160 caractères. */
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
  };
}

/** Les 6 premiers mots, normalisés : deux accroches qui commencent pareil se répètent. */
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

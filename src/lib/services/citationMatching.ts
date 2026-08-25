/**
 * Recherche approximative d'un extrait cité par le LLM dans le texte source, et annotation des
 * passages déjà utilisés (docs/SPEC_MATIERE_EDITEUR.md §3 — remplace le découpage en unités
 * typées). Fonctions pures, testées unitairement, aucun accès DB (voir citationService.ts pour la
 * partie DB-aware).
 */

const SENTENCE_SPLIT_RE = /(?<=[.!?\n])\s+/;
export const MATCH_THRESHOLD = 0.5;

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(/[^a-z0-9à-ÿ]+/)
      .filter(Boolean)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

export interface TextSpan {
  text: string;
  start: number;
}

/** Découpe un texte en phrases, en conservant la position d'origine de chacune. */
export function splitIntoSentences(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let cursor = 0;
  for (const part of text.split(SENTENCE_SPLIT_RE)) {
    if (part.length === 0) continue;
    const start = text.indexOf(part, cursor);
    if (start === -1) continue;
    spans.push({ text: part, start });
    cursor = start + part.length;
  }
  return spans;
}

export interface CitationMatch {
  start: number;
  length: number;
  score: number;
}

/**
 * Cherche `excerpt` (rapporté par le LLM, censé être une citation verbatim mais pas garanti) dans
 * `sourceText`. Chemin rapide : sous-chaîne exacte après normalisation (espaces/casse) — cas le
 * plus fréquent si le modèle a bien cité mot pour mot. Repli : recouvrement de mots (Jaccard) entre
 * l'extrait et chaque phrase du texte source, tolère une reformulation légère. `null` si rien
 * n'atteint `MATCH_THRESHOLD`.
 */
export function findBestMatchInText(excerpt: string, sourceText: string): CitationMatch | null {
  const normalizedExcerpt = normalize(excerpt);
  if (normalizedExcerpt.length === 0) return null;

  const normalizedSource = normalize(sourceText);
  const exactIndex = normalizedSource.indexOf(normalizedExcerpt);
  if (exactIndex !== -1) {
    // Position approximative dans le texte d'origine — la normalisation (espaces compressés) peut
    // légèrement décaler l'index ; suffisant pour l'usage visé (surlignage debug), pas pixel-parfait.
    return { start: exactIndex, length: normalizedExcerpt.length, score: 1 };
  }

  const excerptTokens = tokenize(excerpt);
  if (excerptTokens.size === 0) return null;

  let best: CitationMatch | null = null;
  for (const sentence of splitIntoSentences(sourceText)) {
    const score = jaccard(excerptTokens, tokenize(sentence.text));
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) {
      best = { start: sentence.start, length: sentence.text.length, score };
    }
  }
  return best;
}

export interface Interval {
  start: number;
  length: number;
}

/** Fusionne les intervalles qui se chevauchent ou se touchent, triés par position de départ. */
export function mergeIntervals(spans: Interval[]): Interval[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [sorted[0]];
  for (const span of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    const lastEnd = last.start + last.length;
    const spanEnd = span.start + span.length;
    if (span.start <= lastEnd) {
      last.length = Math.max(lastEnd, spanEnd) - last.start;
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

const USED_MARKER_START = "[déjà utilisé dans un post précédent]";
const USED_MARKER_END = "[/déjà utilisé]";

/** Entoure les zones déjà citées de marqueurs, pour inciter (pas imposer) le LLM à varier plutôt
 *  qu'à reprendre tel quel un passage déjà exploité — jamais de suppression du texte. */
export function annotateUsedSpans(text: string, spans: Interval[]): string {
  const merged = mergeIntervals(spans.filter((s) => s.start >= 0 && s.length > 0 && s.start < text.length));
  if (merged.length === 0) return text;

  let result = "";
  let cursor = 0;
  for (const { start, length } of merged) {
    const s = Math.max(start, cursor);
    const e = Math.min(start + length, text.length);
    if (e <= s) continue;
    result += text.slice(cursor, s);
    result += `${USED_MARKER_START}${text.slice(s, e)}${USED_MARKER_END}`;
    cursor = e;
  }
  result += text.slice(cursor);
  return result;
}

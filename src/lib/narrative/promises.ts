/**
 * Les promesses d'un auteur et les événements qui peuvent les tenir (docs/SPEC_FIL_NARRATIF.md §8).
 *
 * Module PUR : la sélection, pas l'appariement. L'appariement lui-même demande un appel au modèle
 * (src/lib/llm/promiseMatch.ts), parce que les promesses réellement captées sont molles
 * (« dans un prochain épisode, je montrerai comment… ») et qu'aucune règle de code ne décide ça.
 */

import type { PlacementEvent } from "./placement";

/** Un post publié et ce qu'il a promis — `promisesMade`, déjà écrit par le rédacteur. */
export interface PromisingPost {
  scriptId: string;
  date: string;
  promisesMade: string[];
}

export interface OpenPromise {
  scriptId: string;
  date: string;
  promise: string;
}

/** Plafond de candidats soumis au modèle : au-delà, on paie du contexte pour rien. */
const MAX_CANDIDATES = 30;

/**
 * Les promesses encore ouvertes, les plus anciennes d'abord — l'appelant prend la première et
 * laisse les autres pour plus tard : une seule promesse est tenue à la fois.
 */
export function openPromises(published: PromisingPost[], honored: string[]): OpenPromise[] {
  const closed = new Set(honored);
  return published
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((p) => p.promisesMade.filter((promise) => !closed.has(promise)).map((promise) => ({ scriptId: p.scriptId, date: p.date, promise })));
}

/**
 * Les événements qui pourraient tenir une promesse : datés strictement après le post qui l'a faite,
 * pas encore racontés, les plus récents d'abord. Générique sur la forme reçue : le placement n'a
 * besoin que de `id` et `date`, l'appel au modèle veut aussi le titre et ce qui s'est passé.
 */
export function candidateEvents<T extends Pick<PlacementEvent, "id" | "date">>(events: T[], afterDate: string, toldEventIds: string[], limit = MAX_CANDIDATES): T[] {
  const told = new Set(toldEventIds);
  return events
    .filter((e) => e.date !== null && e.date > afterDate && !told.has(e.id))
    .sort((a, b) => (b.date as string).localeCompare(a.date as string))
    .slice(0, limit);
}

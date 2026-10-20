/**
 * Où le fil narratif se pose (docs/SPEC_FIL_NARRATIF.md §6-§7).
 *
 * Module PUR : il ne connaît ni la base ni le modèle. Il reçoit les posts déjà écrits de la série,
 * la ligne de temps du sujet et les champs du sujet, et rend le type de post de récit à écrire —
 * ou null, qui veut dire « un épisode normal », le cas de loin le plus fréquent.
 *
 * Deux règles portent tout le reste : les positions se comptent en POSTS ÉCRITS et jamais en dates
 * (le lecteur ne voit pas les jours vides du calendrier), et le point d'étape se déclenche sur la
 * SUBSTANCE — ce qui a changé depuis le dernier — jamais sur une cadence.
 */

export type NarrativeKind = "origin" | "vision" | "checkpoint" | "promise";

/** Un post déjà écrit de la série. `eventId` est l'événement qu'il a raconté, s'il en a raconté un. */
export interface PlacementPost {
  date: string;
  narrativeKind: NarrativeKind | null;
  eventId: string | null;
}

export interface PlacementEvent {
  id: string;
  date: string | null;
  kind: "failure" | "decision" | "result" | "feedback" | "milestone";
  whatChanged: string | null;
}

export interface PlacementInput {
  /** Posts déjà écrits de la série, par date croissante. */
  written: PlacementPost[];
  /** Ligne de temps du sujet, par date croissante, les non datés en dernier. */
  events: PlacementEvent[];
  /** La série est la plus ancienne non archivée de son sujet : seule celle-là porte origine et vision. */
  isFirstSeries: boolean;
  subject: { problem: string | null; valueProposition: string | null };
  /** Appariement trouvé par la relecture de la matière (§8), déjà validé. */
  promiseMatch: { promise: string; sourceScriptId: string; eventId: string } | null;
}

export interface NarrativeDecision {
  kind: NarrativeKind;
  /** Le périmètre : les seuls événements que ce post aura le droit de lire. */
  eventIds: string[];
  /** L'événement que ce post marque comme raconté — seules l'origine et la promesse en marquent un. */
  marksTold: string | null;
  promise: { text: string; sourceScriptId: string } | null;
}

/** Rang de la vision : laisse un épisode normal entre elle et l'origine. */
const VISION_RANK = 3;
/** Plancher entre deux points d'étape — un plancher, jamais une cadence. */
const MIN_EPISODES_SINCE_NARRATIVE = 4;
/** Ce qui fait qu'il « faut » un point d'étape : assez de choses ont changé. */
const MIN_CHANGED_EVENTS = 3;

/** Le rang du prochain post : les dates distinctes déjà écrites, + 1. */
export function postRank(written: PlacementPost[]): number {
  return new Set(written.map((w) => w.date)).size + 1;
}

/** Ce qui s'est écrit depuis le dernier post de récit — depuis le début s'il n'y en a jamais eu. */
function sinceLastNarrative(written: PlacementPost[]): PlacementPost[] {
  for (let i = written.length - 1; i >= 0; i -= 1) {
    if (written[i].narrativeKind) return written.slice(i + 1);
  }
  return written;
}

export function decideNarrative(input: PlacementInput): NarrativeDecision | null {
  const { written, events, isFirstSeries, subject, promiseMatch } = input;

  // Jamais deux posts de récit à la suite : le fil respire entre deux.
  if (written[written.length - 1]?.narrativeKind) return null;

  const rank = postRank(written);

  // Origine : le tout premier post de la première série, sur le plus ancien événement daté.
  if (rank === 1 && isFirstSeries) {
    const trigger = events.find((e) => e.date !== null);
    if (trigger) return { kind: "origin", eventIds: [trigger.id], marksTold: trigger.id, promise: null };
  }

  // Vision : reportée de rang en rang tant qu'il n'y a pas de décision à quoi l'ancrer.
  if (isFirstSeries && rank >= VISION_RANK && subject.problem && subject.valueProposition && !written.some((w) => w.narrativeKind === "vision")) {
    const decisions = events.filter((e) => e.kind === "decision");
    if (decisions.length > 0) return { kind: "vision", eventIds: decisions.map((e) => e.id), marksTold: null, promise: null };
  }

  // Promesse tenue : prioritaire sur le point d'étape, parce qu'elle a une date de péremption.
  if (promiseMatch) {
    return {
      kind: "promise",
      eventIds: [promiseMatch.eventId],
      marksTold: promiseMatch.eventId,
      promise: { text: promiseMatch.promise, sourceScriptId: promiseMatch.sourceScriptId },
    };
  }

  // Point d'étape : assez de choses ont changé, et assez d'épisodes ont passé.
  const since = sinceLastNarrative(written);
  const episodes = since.filter((w) => !w.narrativeKind).length;
  const told = since.map((w) => w.eventId).filter((id): id is string => id !== null);
  const changed = new Map(events.map((e) => [e.id, e])); // la ligne de temps, pour relire whatChanged
  const withChange = told.filter((id) => changed.get(id)?.whatChanged);
  if (episodes >= MIN_EPISODES_SINCE_NARRATIVE && withChange.length >= MIN_CHANGED_EVENTS) {
    return { kind: "checkpoint", eventIds: told, marksTold: null, promise: null };
  }

  return null;
}

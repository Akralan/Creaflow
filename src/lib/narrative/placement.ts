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

export type NarrativeKind = "origin" | "checkpoint" | "promise";

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
  /** La série est la plus ancienne non archivée de son sujet : seule celle-là porte l'origine. */
  isFirstSeries: boolean;
  /** RETIRÉ avec la vision le 2026-10-21 : c'était sa seule lectrice (elle exigeait un problème et
   *  une proposition de valeur renseignés). Les mots de l'auteur sur son projet vont au rédacteur par le
   *  brief, pas au placement. */
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

export interface SeriesCandidate {
  id: string;
  /** Millisecondes. Les séries proposées en fin d'onboarding les ont TOUTES identiques. */
  createdAt: number;
  /** Sans rythme, une série ne crée aucun créneau : elle ne peut pas porter le fil. */
  hasRhythm: boolean;
  archived: boolean;
  /** Jour du premier post écrit de la série (YYYY-MM-DD), null si elle n'a rien écrit. */
  firstPostDate: string | null;
}

/**
 * La « première série d'un sujet » — celle qui porte l'origine (§7).
 *
 * Pas simplement la plus ancienne : les séries proposées en fin d'onboarding sont toutes créées dans
 * la même insertion et portent la MÊME date à la microseconde, si bien qu'un tri par date désigne
 * n'importe laquelle — y compris une série sans rythme qui n'écrira jamais rien, et l'origine ne
 * sort alors jamais. D'où ces trois règles, dans l'ordre :
 *
 * 1. seules les séries vivantes qui publient (un rythme) sont candidates ;
 * 2. si l'une publie déjà, c'est celle dont le premier post est le plus ancien — une fois le fil
 *    commencé, il ne change plus de série ;
 * 3. sinon la plus ancienne par date de création, l'identifiant tranchant les égalités pour que
 *    deux exécutions donnent la même réponse.
 */
export function firstSeriesOfSubject(candidates: SeriesCandidate[]): string | null {
  const alive = candidates.filter((c) => !c.archived && c.hasRhythm);
  if (alive.length === 0) return null;
  const publishing = alive.filter((c) => c.firstPostDate !== null);
  if (publishing.length > 0) {
    return publishing.sort((a, b) => (a.firstPostDate as string).localeCompare(b.firstPostDate as string) || a.id.localeCompare(b.id))[0].id;
  }
  return alive.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0].id;
}

/** Ce que l'origine a le droit de lire : le début de l'histoire, assez pour la comprendre. */
const ORIGIN_SCOPE = 1;


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
  const { written, events, isFirstSeries, promiseMatch } = input;

  // Jamais deux posts de récit à la suite : le fil respire entre deux.
  if (written[written.length - 1]?.narrativeKind) return null;

  const rank = postRank(written);

  // Origine : OBLIGATOIRE au premier post de la première série, qu'il y ait des événements ou non.
  // Elle ne raconte PAS forcément un événement (décision du fondateur, 2026-10-21) : c'est la présentation
  // du projet et la raison pour laquelle l'auteur se met à construire en public. Un moment fondateur, s'il
  // existe dans la matière, lui sert d'ancre — et il est alors marqué raconté. Sinon le périmètre est vide
  // et le post s'écrit sur les mots de l'auteur : ce qu'il construit, pour qui, le problème, ses attentes.
  if (rank === 1 && isFirstSeries) {
    const scope = events.slice(0, ORIGIN_SCOPE);
    return { kind: "origin", eventIds: scope.map((e) => e.id), marksTold: scope[0]?.id ?? null, promise: null };
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

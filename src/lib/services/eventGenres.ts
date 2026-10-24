import { OPEN_CAP, type OpenEvent } from "@/lib/llm/pointerExtractor";
import { HOLDABLE_GENRES, type Genre, type HoldableGenre } from "@/lib/llm/postForms";

/**
 * Les deux règles de genre que l'extracteur ne peut pas tenir seul, parce qu'il lit un document à
 * la fois (docs/FORMES_ET_GENRES.md Partie 1, règles 13 et 14). Pures, pour être testables sans base
 * et partagées entre le service et le banc.
 */

export interface GenreEventRow {
  id: string;
  genre: Genre;
  date: string | null;
  line: number;
  sourceMaterialId: string;
  /** Un autre événement a déjà `tient` sur celui-ci. */
  heldBy: boolean;
}

function isHoldable(genre: Genre): genre is HoldableGenre {
  return (HOLDABLE_GENRES as readonly string[]).includes(genre);
}

/**
 * La liste ouverte envoyée au lecteur : les engagements et annonces que rien ne tient encore, et
 * toutes les décisions (on peut revenir plusieurs fois sur une décision). Les plus récents d'abord,
 * plafonnée. `texts` donne les lignes de chaque document pour que le lecteur sache ce qui était
 * promis ; un événement dont le texte est introuvable est écarté.
 */
export function openEventsFor(events: GenreEventRow[], texts: Map<string, string[]>, cap = OPEN_CAP): OpenEvent[] {
  return events
    .filter((e) => isHoldable(e.genre) && (e.genre === "décision" || !e.heldBy))
    .map((e) => ({ e, text: texts.get(e.sourceMaterialId)?.[e.line - 1] }))
    .filter((x): x is { e: GenreEventRow; text: string } => typeof x.text === "string" && x.text.trim().length > 0)
    .sort((a, b) => (b.e.date ?? "").localeCompare(a.e.date ?? ""))
    .slice(0, cap)
    .map(({ e, text }) => ({ id: e.id, genre: e.genre as HoldableGenre, date: e.date, text }));
}

/**
 * Un seul `déclencheur` par sujet : le plus ancien (date, puis ordre d'enregistrement ; un
 * déclencheur sans date passe après les datés). Rend les ids des autres, à ramener à `livraison`.
 */
export function keepOldestTrigger(events: Array<{ id: string; genre: Genre; date: string | null; createdAt: Date }>): string[] {
  const triggers = events
    .filter((e) => e.genre === "déclencheur")
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.createdAt.getTime() - b.createdAt.getTime());
  return triggers.slice(1).map((e) => e.id);
}

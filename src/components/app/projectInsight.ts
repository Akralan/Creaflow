/**
 * La part pure de la modale « Understand it » de Business context (docs/SPEC_COMPRENDRE_LE_PROJET.md) :
 * les libellés des genres d'événements tels que l'écran les montre, et le tri des compteurs.
 *
 * Les identifiants sont ceux de `material_event_genre` (docs/FORMES_ET_GENRES.md). La liste est
 * recopiée ici plutôt qu'importée de `postForms.ts`, qui tire les 86 Ko de modèles de posts : ce
 * fichier part dans le navigateur.
 */

export const GENRE_LABELS: Record<string, string> = {
  livraison: "Things shipped",
  décision: "Decisions",
  échec: "Things that failed",
  leçon: "Lessons",
  chiffre: "Numbers",
  annonce: "Announcements",
  question: "Open questions",
  engagement: "Commitments",
  retour_utilisateur: "User feedback",
  offre: "Offers",
  coulisse: "Behind the scenes",
  réaction: "Reactions to others",
  déclencheur: "Where it started",
};

export interface GenreCount {
  genre: string;
  label: string;
  count: number;
}

/** Les genres présents, du plus nombreux au moins nombreux ; à égalité, l'ordre de `GENRE_LABELS`.
 *  Un genre inconnu (ajouté côté base sans libellé ici) garde son identifiant plutôt que d'être perdu. */
export function sortGenreCounts(byGenre: Readonly<Record<string, number>>): GenreCount[] {
  const order = Object.keys(GENRE_LABELS);
  const rank = (g: string) => (order.indexOf(g) === -1 ? order.length : order.indexOf(g));
  return Object.entries(byGenre)
    .filter(([, count]) => count > 0)
    .map(([genre, count]) => ({ genre, label: GENRE_LABELS[genre] ?? genre, count }))
    .sort((a, b) => b.count - a.count || rank(a.genre) - rank(b.genre));
}

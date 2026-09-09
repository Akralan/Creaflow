import { creatorVertical } from "./creator";
import { sourceFirstVertical } from "./sourceFirst";
import type { VerticalDefinition, VerticalId } from "./types";

/**
 * Verticale → définition. Seul endroit à toucher pour en ajouter une
 * (docs/ARCHITECTURE_VERTICALES.md §4, chantier 2).
 *
 * Les trois verticales issues d'un fournisseur tiers pointent délibérément vers la MÊME fabrique :
 * elles ne diffèrent aujourd'hui que par leur nom (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.2). Écrire
 * trois jeux de textes avant d'avoir un utilisateur de chaque métier serait deviner.
 *
 * Module CLIENT : il rend du JSX. Ne jamais y importer de code serveur.
 */
const verticals: Record<VerticalId, VerticalDefinition> = {
  creator: creatorVertical,
  dev: sourceFirstVertical("dev"),
  artisan: sourceFirstVertical("artisan"),
  entrepreneur: sourceFirstVertical("entrepreneur"),
};

export function getVertical(id: VerticalId): VerticalDefinition {
  return verticals[id] ?? creatorVertical;
}

import { creatorVertical } from "./creator";
import { devVertical } from "./dev";
import type { VerticalDefinition, VerticalId } from "./types";

/**
 * Verticale → définition. Seul endroit à toucher pour en ajouter une
 * (docs/ARCHITECTURE_VERTICALES.md §4, chantier 2).
 *
 * Module CLIENT : il rend du JSX. Ne jamais y importer de code serveur — la logique de la verticale
 * dev qui lit la base vit dans `services/devOnboardingContext`.
 */
const verticals: Record<VerticalId, VerticalDefinition> = {
  creator: creatorVertical,
  dev: devVertical,
};

export function getVertical(id: VerticalId): VerticalDefinition {
  return verticals[id] ?? creatorVertical;
}

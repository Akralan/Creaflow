import { githubConnector } from "./github";
import { linearConnector } from "./linear";
import { notionConnector } from "./notion";
import type { MaterialSourceType, SourceConnector } from "./types";

/**
 * Type de source → implémentation. Seul endroit à toucher pour brancher un nouveau fournisseur de
 * matière (docs/ARCHITECTURE_VERTICALES.md §4, chantier 1).
 *
 * Le registre stocke les connecteurs avec leurs métadonnées effacées (`SourceConnector` sans
 * paramètre) : le cœur n'en lit jamais le contenu. Une route qui a besoin des métadonnées typées
 * importe son connecteur directement — c'est ce que fait /api/github/repos.
 */
const connectors: Record<MaterialSourceType, SourceConnector> = {
  github_repo: githubConnector,
  notion_page: notionConnector,
  linear_project: linearConnector,
};

export function getConnector(type: MaterialSourceType): SourceConnector {
  const connector = connectors[type];
  if (!connector) {
    // Atteignable si une valeur est ajoutée à materialSourceTypeEnum sans son implémentation.
    throw new Error(`Aucun connecteur enregistré pour le type de source "${type}".`);
  }
  return connector;
}

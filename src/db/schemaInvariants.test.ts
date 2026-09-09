import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import * as schema from "./schema";

/**
 * Garde-fou du chantier 4 (docs/ARCHITECTURE_VERTICALES.md) : une verticale n'ajoute pas de table
 * et ne partitionne pas le modèle de données.
 *
 * La règle a besoin d'un test parce qu'elle ne se voit pas dans une revue ligne à ligne : ajouter
 * une colonne `vertical` à une table paraît anodin, et c'est exactement le premier pas vers deux
 * jeux de migrations divergents — le point de non-retour qui transformerait l'option A en option C.
 */

type IntrospectableColumn = { getSQLType: () => string };

function columnsOfType(sqlType: string): string[] {
  const found: string[] = [];
  for (const exported of Object.values(schema)) {
    if (!isTable(exported)) continue;
    const table = getTableName(exported);
    for (const [name, column] of Object.entries(getTableColumns(exported))) {
      if ((column as IntrospectableColumn).getSQLType() === sqlType) {
        found.push(`${table}.${name}`);
      }
    }
  }
  return found.sort();
}

describe("la verticale ne partitionne pas le modèle de données", () => {
  it("n'est portée que par users.vertical, et par aucune autre table", () => {
    // Une deuxième colonne `vertical` ailleurs voudrait dire que des lignes appartiennent à une
    // verticale — donc des requêtes, des index et bientôt des tables qui divergent par verticale.
    // Ce qu'une verticale a de spécifique passe par materialSources.config, pas par le schéma.
    expect(columnsOfType("vertical")).toEqual(["users.vertical"]);
  });
});

describe("le point d'extension des connecteurs reste ouvert", () => {
  const materialSources = getTableColumns(schema.materialSources);

  it("materialSources.config est un jsonb : c'est là que va le spécifique d'un fournisseur", () => {
    // Le remplacer par des colonnes typées par fournisseur (github_branch, notion_database_id…)
    // ferait porter au cœur la connaissance de chaque connecteur.
    expect((materialSources.config as IntrospectableColumn).getSQLType()).toBe("jsonb");
  });

  it("materialSources.type reste un enum, seul discriminant du connecteur à résoudre", () => {
    expect((materialSources.type as IntrospectableColumn).getSQLType()).toBe("material_source_type");
  });
});

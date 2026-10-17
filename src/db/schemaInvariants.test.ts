import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import * as schema from "./schema";

/**
 * Guard rail for work item 4 (docs/ARCHITECTURE_VERTICALES.md): a vertical adds no table
 * and does not partition the data model.
 *
 * The rule needs a test because it is not visible in a line-by-line review: adding
 * a `vertical` column to a table looks harmless, and it is exactly the first step toward two
 * diverging sets of migrations — the point of no return that would turn option A into option C.
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

describe("the vertical does not partition the data model", () => {
  it("is carried only by users.vertical, and by no other table", () => {
    // A second `vertical` column elsewhere would mean rows belong to a
    // vertical — hence queries, indexes and soon tables that diverge by vertical.
    // What is specific to a vertical goes through materialSources.config, not through the schema.
    expect(columnsOfType("vertical")).toEqual(["users.vertical"]);
  });
});

describe("the connector extension point stays open", () => {
  const materialSources = getTableColumns(schema.materialSources);

  it("materialSources.config is a jsonb: this is where a provider's specifics go", () => {
    // Replacing it with provider-typed columns (github_branch, notion_database_id…)
    // would make the core carry knowledge of each connector.
    expect((materialSources.config as IntrospectableColumn).getSQLType()).toBe("jsonb");
  });

  it("materialSources.type stays an enum, the single discriminant of the connector to resolve", () => {
    expect((materialSources.type as IntrospectableColumn).getSQLType()).toBe("material_source_type");
  });
});

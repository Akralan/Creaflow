import { describe, expect, it } from "vitest";
import { getConnector } from "./registry";
import type { MaterialSourceType } from "./types";

const TYPES: MaterialSourceType[] = ["github_repo", "notion_page", "linear_project"];

describe("getConnector", () => {
  it("résout le type stocké en base vers son implémentation", () => {
    for (const type of TYPES) {
      expect(getConnector(type).type).toBe(type);
    }
  });

  it("échoue bruyamment sur un type sans implémentation — le cas d'une valeur ajoutée à l'enum PostgreSQL sans son connecteur", () => {
    expect(() => getConnector("etsy_section" as MaterialSourceType)).toThrow(/etsy_section/);
  });
});

describe.each(TYPES)("contrat du connecteur %s", (type) => {
  const connector = getConnector(type);

  it("expose tout le contrat, pour qu'un connecteur incomplet ne passe pas la relecture", () => {
    expect(typeof connector.assertReady).toBe("function");
    expect(typeof connector.listCandidates).toBe("function");
    expect(typeof connector.fetchDocuments).toBe("function");
    expect(typeof connector.isAuthError).toBe("function");
    // Portés par materialSources.lastError : vides, l'utilisateur verrait une source en erreur sans
    // savoir pourquoi.
    expect(connector.emptyMessage).toBeTruthy();
    expect(connector.truncatedMessage).toBeTruthy();
    // Remonté par l'API avec chaque source : c'est ce qui permet à ConnectedSources de dire
    // « reconnecte GitHub » sans coder le nom en dur.
    expect(connector.displayName).toBeTruthy();
  });

  it("ne parle de sa source qu'à travers ses propres messages, jamais d'une source abstraite", () => {
    // Un message générique ("cette source est vide") signalerait un connecteur écrit à moitié : le
    // contrat existe précisément pour que chacun nomme ce qu'il lit.
    expect(connector.emptyMessage).not.toMatch(/cette source/i);
  });
});

import { describe, expect, it } from "vitest";
import { getConnector } from "./registry";
import type { MaterialSourceType } from "./types";

describe("getConnector", () => {
  it("résout le type stocké en base vers son implémentation", () => {
    expect(getConnector("github_repo").type).toBe("github_repo");
  });

  it("échoue bruyamment sur un type sans implémentation — le cas d'une valeur ajoutée à l'enum PostgreSQL sans son connecteur", () => {
    expect(() => getConnector("notion_page" as MaterialSourceType)).toThrow(/notion_page/);
  });

  it("expose tout le contrat, pour qu'un connecteur incomplet ne passe pas la relecture", () => {
    const connector = getConnector("github_repo");
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
});

import { describe, expect, it } from "vitest";
import { buildUpdateJournal, issueToText, toCandidate } from "./linearMapping";

const update = (id: string, createdAt: string, body: string, authorName: string | null = null) => ({
  id,
  createdAt,
  body,
  authorName,
});

describe("buildUpdateJournal", () => {
  it("ordonne du plus ancien au plus récent, quel que soit l'ordre reçu", () => {
    const journal = buildUpdateJournal([
      update("u2", "2026-03-02T09:00:00.000Z", "Deuxième"),
      update("u1", "2026-03-01T09:00:00.000Z", "Premier"),
    ]);
    expect(journal.indexOf("Premier")).toBeLessThan(journal.indexOf("Deuxième"));
  });

  it("date chaque entrée et nomme son auteur quand il est connu", () => {
    expect(buildUpdateJournal([update("u1", "2026-03-01T09:00:00.000Z", "Corps", "Alix")])).toBe(
      "## 2026-03-01 — Alix\n\nCorps"
    );
    expect(buildUpdateJournal([update("u1", "2026-03-01T09:00:00.000Z", "Corps")])).toBe("## 2026-03-01\n\nCorps");
  });

  it("écarte les updates vides et rend une chaîne vide s'il n'en reste aucun", () => {
    expect(buildUpdateJournal([update("u1", "2026-03-01T09:00:00.000Z", "   ")])).toBe("");
    expect(buildUpdateJournal([])).toBe("");
  });
});

describe("issueToText", () => {
  const issue = {
    id: "i1",
    identifier: "CRE-12",
    title: "Corriger la synchro",
    description: "Le curseur n'était pas remis à jour.",
    completedAt: "2026-03-04T12:00:00.000Z",
    updatedAt: "2026-03-04T12:00:00.000Z",
  };

  it("porte l'identifiant, le titre, la date et le détail", () => {
    expect(issueToText(issue)).toBe(
      "# CRE-12 — Corriger la synchro\n\nTerminée le 2026-03-04.\n\nLe curseur n'était pas remis à jour."
    );
  });

  it("tient sans description ni date de fin", () => {
    expect(issueToText({ ...issue, description: null, completedAt: null })).toBe("# CRE-12 — Corriger la synchro");
  });
});

describe("toCandidate", () => {
  it("reprend la description du projet comme description du sujet", () => {
    expect(
      toCandidate({
        id: "p1",
        name: "CreaFlow",
        description: "Rédacteur en chef IA",
        updatedAt: "2026-03-04T12:00:00.000Z",
        teamNames: ["Produit"],
      })
    ).toEqual({
      externalId: "p1",
      label: "CreaFlow",
      subjectName: "CreaFlow",
      subjectDescription: "Rédacteur en chef IA",
      config: {},
      meta: { updatedAt: "2026-03-04T12:00:00.000Z", teamNames: ["Produit"] },
    });
  });
});

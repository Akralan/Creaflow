import { describe, expect, it } from "vitest";
import { GENRE_LABELS, sortGenreCounts } from "./projectInsight";

describe("sortGenreCounts", () => {
  it("garde les genres présents, du plus nombreux au moins nombreux", () => {
    const rows = sortGenreCounts({ livraison: 12, décision: 30, échec: 0, leçon: 4 });
    expect(rows.map((r) => r.genre)).toEqual(["décision", "livraison", "leçon"]);
    expect(rows[0].label).toBe("Decisions");
  });

  it("à égalité, l'ordre des libellés", () => {
    expect(sortGenreCounts({ question: 2, chiffre: 2 }).map((r) => r.genre)).toEqual(["chiffre", "question"]);
  });

  it("un genre sans libellé garde son identifiant", () => {
    expect(sortGenreCounts({ inconnu: 1 })).toEqual([{ genre: "inconnu", label: "inconnu", count: 1 }]);
  });

  it("les treize genres ont un libellé", () => {
    expect(Object.keys(GENRE_LABELS)).toHaveLength(13);
  });
});

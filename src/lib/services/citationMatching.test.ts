import { describe, expect, it } from "vitest";
import { annotateUsedSpans, findBestMatchInText, mergeIntervals, splitIntoSentences } from "./citationMatching";

describe("splitIntoSentences", () => {
  it("découpe sur les limites de phrase en conservant la position d'origine", () => {
    const text = "Premier point. Deuxième point ! Troisième ?";
    const sentences = splitIntoSentences(text);
    expect(sentences.map((s) => s.text)).toEqual(["Premier point.", "Deuxième point !", "Troisième ?"]);
    for (const s of sentences) {
      expect(text.slice(s.start, s.start + s.text.length)).toBe(s.text);
    }
  });

  it("renvoie un tableau vide pour un texte vide", () => {
    expect(splitIntoSentences("")).toEqual([]);
  });
});

describe("findBestMatchInText", () => {
  const source = "On a décidé de prioriser le combat avant la navigation. Le mouvement est moins naturel qu'attendu.";

  it("trouve une citation exacte (chemin rapide)", () => {
    const match = findBestMatchInText("prioriser le combat avant la navigation", source);
    expect(match).not.toBeNull();
    expect(match!.score).toBe(1);
    expect(source.slice(match!.start, match!.start + match!.length).toLowerCase()).toContain("prioriser le combat");
  });

  it("tolère une reformulation légère via le recouvrement de mots", () => {
    const match = findBestMatchInText("mouvement moins naturel qu'attendu", source);
    expect(match).not.toBeNull();
  });

  it("renvoie null si rien ne correspond", () => {
    expect(findBestMatchInText("recette de cuisine pour un gâteau au chocolat", source)).toBeNull();
  });

  it("renvoie null pour un extrait vide", () => {
    expect(findBestMatchInText("", source)).toBeNull();
    expect(findBestMatchInText("   ", source)).toBeNull();
  });
});

describe("mergeIntervals", () => {
  it("fusionne les intervalles qui se chevauchent", () => {
    expect(mergeIntervals([{ start: 0, length: 10 }, { start: 5, length: 10 }])).toEqual([{ start: 0, length: 15 }]);
  });

  it("fusionne les intervalles qui se touchent exactement", () => {
    expect(mergeIntervals([{ start: 0, length: 5 }, { start: 5, length: 5 }])).toEqual([{ start: 0, length: 10 }]);
  });

  it("ne fusionne pas des intervalles disjoints", () => {
    expect(mergeIntervals([{ start: 0, length: 5 }, { start: 20, length: 5 }])).toEqual([
      { start: 0, length: 5 },
      { start: 20, length: 5 },
    ]);
  });

  it("trie avant de fusionner, ordre d'entrée indifférent", () => {
    expect(mergeIntervals([{ start: 20, length: 5 }, { start: 0, length: 5 }])).toEqual([
      { start: 0, length: 5 },
      { start: 20, length: 5 },
    ]);
  });

  it("renvoie un tableau vide pour une entrée vide", () => {
    expect(mergeIntervals([])).toEqual([]);
  });
});

describe("annotateUsedSpans", () => {
  const text = "Bonjour le monde, ceci est un texte de test.";

  it("renvoie le texte inchangé sans zones à annoter", () => {
    expect(annotateUsedSpans(text, [])).toBe(text);
  });

  it("entoure une zone citée de marqueurs sans supprimer de texte", () => {
    const result = annotateUsedSpans(text, [{ start: 8, length: 9 }]); // "le monde,"
    expect(result).toContain("[déjà utilisé dans un post précédent]le monde,[/déjà utilisé]");
    expect(result.replace(/\[.*?\]/g, "")).toBe(text);
  });

  it("fusionne les zones chevauchantes avant d'annoter (pas de marqueurs imbriqués)", () => {
    const result = annotateUsedSpans(text, [
      { start: 0, length: 10 },
      { start: 5, length: 10 },
    ]);
    expect(result.match(/\[déjà utilisé dans un post précédent\]/g)?.length).toBe(1);
  });

  it("ignore les intervalles hors bornes sans planter", () => {
    expect(() => annotateUsedSpans(text, [{ start: -5, length: 3 }, { start: 1000, length: 3 }])).not.toThrow();
  });
});

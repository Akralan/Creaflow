import { describe, expect, it } from "vitest";

import { FORMS, FORM_LABELS, GENRES, WHO_SPEAKS, formFor, formText, genreToFormTable, isForm, isGenre } from "./postForms";

describe("formFor", () => {
  it("livraison → episode, livraison disponible → launch", () => {
    expect(formFor({ genre: "livraison", disponible: false, tientGenre: null })).toBe("episode");
    expect(formFor({ genre: "livraison", disponible: true, tientGenre: null })).toBe("launch");
  });

  it("tient gagne sur le genre : engagement → promise_kept, décision → looking_back, annonce → launch", () => {
    expect(formFor({ genre: "livraison", disponible: false, tientGenre: "engagement" })).toBe("promise_kept");
    expect(formFor({ genre: "chiffre", disponible: false, tientGenre: "décision" })).toBe("looking_back");
    expect(formFor({ genre: "livraison", disponible: false, tientGenre: "annonce" })).toBe("launch");
  });

  it("décision seule → episode, déclencheur → origin", () => {
    expect(formFor({ genre: "décision", disponible: false, tientGenre: null })).toBe("episode");
    expect(formFor({ genre: "déclencheur", disponible: false, tientGenre: null })).toBe("origin");
  });

  it("chaque genre a une forme", () => {
    for (const g of GENRES) expect(isForm(formFor({ genre: g, disponible: false, tientGenre: null }))).toBe(true);
  });
});

describe("formText", () => {
  it("chaque forme commence par le préambule commun et porte ses cinq rubriques", () => {
    for (const f of FORMS) {
      const t = formText(f);
      expect(t.startsWith(WHO_SPEAKS)).toBe(true);
      for (const h of ["Reads:", "Opens:", "Body:", "Ends:", "Never:"]) expect(t).toContain(h);
    }
  });

  it("looking_back a sa propre forme depuis le 2026-10-26", () => {
    const strip = (s: string) => s.split("\n").filter((l) => !l.startsWith("Form:")).join("\n");
    expect(strip(formText("promise_kept"))).not.toBe(strip(formText("looking_back")));
  });

  it("porte de vrais posts en modèles pour les formes qui en ont dans le relevé", () => {
    for (const f of ["episode", "launch", "failure", "proof", "promise_kept", "lesson", "curation", "backstage", "origin"] as const) {
      expect(formText(f)).toContain('<example n="1"');
      expect(formText(f)).toContain("never copy a line");
    }
  });
});

describe("genreToFormTable", () => {
  it("a une ligne par genre et aucune rubrique de forme", () => {
    const t = genreToFormTable();
    for (const g of GENRES) expect(t).toContain(`${g} →`);
    expect(t).not.toContain("Opens");
    expect(t).toContain("promise_kept");
    expect(t).toContain("looking_back");
  });
});

describe("étiquettes et gardes", () => {
  it("l'épisode n'a pas d'étiquette, toutes les autres formes en ont une", () => {
    expect(FORM_LABELS.episode).toBeNull();
    for (const f of FORMS) if (f !== "episode") expect(FORM_LABELS[f]).toBeTruthy();
  });

  it("isGenre / isForm", () => {
    expect(isGenre("échec")).toBe(true);
    expect(isGenre("truc")).toBe(false);
    expect(isForm("sonnet")).toBe(false);
  });
});

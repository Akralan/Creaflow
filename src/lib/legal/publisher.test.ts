import { describe, expect, it } from "vitest";
import {
  PUBLISHER,
  getContactEmail,
  isPlaceholder,
  isPublisherComplete,
  missingPublisherFields,
  type PublisherIdentity,
} from "./publisher";

const complete: PublisherIdentity = {
  name: "Alix Exemple",
  legalForm: "Entrepreneur individuel",
  address: "1 rue de l'Exemple, 75000 Paris",
  siret: "123 456 789 00012",
  vat: "TVA non applicable, art. 293 B du CGI",
  contactEmail: "contact@example.com",
  publicationDirector: "Alix Exemple",
  appHost: { name: "Hébergeur A", address: "Adresse A", contact: "contact@a.example" },
  dbHost: { name: "Hébergeur B", address: "Adresse B", contact: "contact@b.example" },
  consumerMediator: { name: "Médiateur X", url: "https://mediateur.example" },
};

describe("isPlaceholder", () => {
  it("reconnaît une valeur vide ou entre crochets", () => {
    expect(isPlaceholder("")).toBe(true);
    expect(isPlaceholder("   ")).toBe(true);
    expect(isPlaceholder("[Nom de l'éditeur]")).toBe(true);
  });

  it("laisse passer une vraie valeur, même avec des crochets à l'intérieur", () => {
    expect(isPlaceholder("Alix Exemple")).toBe(false);
    expect(isPlaceholder("SAS Exemple [Paris]")).toBe(false);
  });
});

describe("isPublisherComplete", () => {
  it("est faux tant que l'identité réelle n'est pas renseignée (état actuel du dépôt)", () => {
    // Si ce test casse parce que l'identité a été remplie, c'est le signal attendu : la bannière
    // « document en cours de finalisation » disparaît d'elle-même des pages légales.
    expect(isPublisherComplete(PUBLISHER)).toBe(false);
    expect(missingPublisherFields(PUBLISHER)).toContain("name");
  });

  it("est vrai dès que tous les champs, y compris les hébergeurs et le médiateur, sont remplis", () => {
    expect(isPublisherComplete(complete)).toBe(true);
    expect(missingPublisherFields(complete)).toEqual([]);
  });

  it("nomme précisément le champ imbriqué qui manque", () => {
    const partial = { ...complete, dbHost: { ...complete.dbHost, contact: "[Contact]" } };
    expect(missingPublisherFields(partial)).toEqual(["dbHost.contact"]);
  });
});

describe("getContactEmail", () => {
  it("ne renvoie jamais un placeholder, pour ne pas produire un mailto cassé", () => {
    expect(getContactEmail(PUBLISHER)).toBeNull();
    expect(getContactEmail(complete)).toBe("contact@example.com");
  });
});

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
  name: "Alex Example",
  legalForm: "Sole proprietor",
  address: "1 Example Street, 75000 Paris",
  siret: "123 456 789 00012",
  vat: "VAT not applicable, art. 293 B of the French General Tax Code",
  contactEmail: "contact@example.com",
  publicationDirector: "Alex Example",
  appHost: { name: "Host A", address: "Address A", contact: "contact@a.example" },
  dbHost: { name: "Host B", address: "Address B", contact: "contact@b.example" },
  consumerMediator: { name: "Mediator X", url: "https://mediateur.example" },
};

describe("isPlaceholder", () => {
  it("recognizes an empty or bracketed value", () => {
    expect(isPlaceholder("")).toBe(true);
    expect(isPlaceholder("   ")).toBe(true);
    expect(isPlaceholder("[Publisher name]")).toBe(true);
  });

  it("lets a real value through, even with brackets inside", () => {
    expect(isPlaceholder("Alex Example")).toBe(false);
    expect(isPlaceholder("SAS Exemple [Paris]")).toBe(false);
  });
});

describe("isPublisherComplete", () => {
  it("is false until the real identity is filled in (current state of the repo)", () => {
    // If this test breaks because the identity was filled in, that is the expected signal: the
    // "document being finalized" banner disappears from the legal pages by itself.
    expect(isPublisherComplete(PUBLISHER)).toBe(false);
    expect(missingPublisherFields(PUBLISHER)).toContain("name");
  });

  it("is true as soon as all fields, including hosts and mediator, are filled in", () => {
    expect(isPublisherComplete(complete)).toBe(true);
    expect(missingPublisherFields(complete)).toEqual([]);
  });

  it("names the exact missing nested field", () => {
    const partial = { ...complete, dbHost: { ...complete.dbHost, contact: "[Contact]" } };
    expect(missingPublisherFields(partial)).toEqual(["dbHost.contact"]);
  });
});

describe("getContactEmail", () => {
  it("never returns a placeholder, to avoid producing a broken mailto", () => {
    expect(getContactEmail(PUBLISHER)).toBeNull();
    expect(getContactEmail(complete)).toBe("contact@example.com");
  });
});

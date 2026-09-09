import { describe, expect, it } from "vitest";
import { repoPayloadSchema, toCandidate, toRepoPayload, type RepoPayload } from "./githubMapping";

const repo: RepoPayload = {
  externalId: "12345",
  fullName: "akralan/creaflow",
  name: "creaflow",
  description: "Un outil éditorial",
  defaultBranch: "develop",
  language: "TypeScript",
  pushedAt: "2026-09-01T10:00:00Z",
};

describe("toCandidate", () => {
  it("nomme le sujet d'après le nom court et garde owner/repo comme label de la source", () => {
    const candidate = toCandidate(repo);
    // L'inversion des deux ne casserait aucun type — les deux sont des string — et créerait des
    // sujets nommés "akralan/creaflow".
    expect(candidate.subjectName).toBe("creaflow");
    expect(candidate.label).toBe("akralan/creaflow");
  });

  it("range la branche par défaut dans config, d'où fetchDocuments la relit", () => {
    expect(toCandidate(repo).config).toEqual({ defaultBranch: "develop" });
  });

  it("range langage et date de push dans meta : le cœur les transporte sans les lire", () => {
    expect(toCandidate(repo).meta).toEqual({ language: "TypeScript", pushedAt: "2026-09-01T10:00:00Z" });
  });

  it("laisse passer une description absente — beaucoup de dépôts n'en ont pas", () => {
    expect(toCandidate({ ...repo, description: null }).subjectDescription).toBeNull();
  });
});

describe("aller-retour", () => {
  it("restitue le dépôt à l'identique, ce qui interdit toute permutation de champs", () => {
    expect(toRepoPayload(toCandidate(repo))).toEqual(repo);
  });

  it("retombe sur main pour une source dont la branche n'a pas été stockée", () => {
    const candidate = { ...toCandidate(repo), config: {} };
    expect(toRepoPayload(candidate).defaultBranch).toBe("main");
  });
});

describe("repoPayloadSchema", () => {
  it("accepte la charge que RepoPicker renvoie", () => {
    expect(repoPayloadSchema.parse(repo)).toEqual(repo);
  });

  it("refuse un externalId vide, qui rendrait la source impossible à dédoublonner", () => {
    expect(() => repoPayloadSchema.parse({ ...repo, externalId: "" })).toThrow();
  });
});

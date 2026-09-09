import { describe, expect, it } from "vitest";
import { diffDocuments } from "./sourceConnectorService";

const incoming = (externalRef: string, externalChecksum: string) => ({
  externalRef,
  externalChecksum,
  title: externalRef,
  rawText: `contenu de ${externalRef}`,
});

describe("diffDocuments", () => {
  it("insère un document absent de la base", () => {
    const diff = diffDocuments([], [incoming("README.md", "sha1")]);
    expect(diff.toInsert.map((d) => d.externalRef)).toEqual(["README.md"]);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(0);
  });

  it("n'écrit RIEN quand le checksum est identique — c'est ce qui rend le bouton re-sync sûr à cliquer en boucle", () => {
    const diff = diffDocuments(
      [{ id: "m1", externalRef: "README.md", externalChecksum: "sha1" }],
      [incoming("README.md", "sha1")]
    );
    expect(diff.toInsert).toEqual([]);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it("met à jour un document dont le checksum a changé, en conservant son id", () => {
    const diff = diffDocuments(
      [{ id: "m1", externalRef: "README.md", externalChecksum: "sha1" }],
      [incoming("README.md", "sha2")]
    );
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].id).toBe("m1");
    expect(diff.toUpdate[0].doc.externalChecksum).toBe("sha2");
    expect(diff.toInsert).toEqual([]);
  });

  it("met à jour un document existant dont le checksum est null (ingéré avant cette colonne)", () => {
    const diff = diffDocuments(
      [{ id: "m1", externalRef: "README.md", externalChecksum: null }],
      [incoming("README.md", "sha1")]
    );
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.unchanged).toBe(0);
  });

  it("laisse intact un document dont le chemin a disparu du dépôt", () => {
    const diff = diffDocuments(
      [
        { id: "m1", externalRef: "README.md", externalChecksum: "sha1" },
        { id: "m2", externalRef: "docs/supprime.md", externalChecksum: "sha9" },
      ],
      [incoming("README.md", "sha1")]
    );
    // Ni insertion, ni mise à jour, ni suppression : le document survit tel quel.
    expect(diff.toInsert).toEqual([]);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it("traite plusieurs documents en un seul passage", () => {
    const diff = diffDocuments(
      [
        { id: "m1", externalRef: "a.md", externalChecksum: "sha1" },
        { id: "m2", externalRef: "b.md", externalChecksum: "old" },
      ],
      [incoming("a.md", "sha1"), incoming("b.md", "new"), incoming("c.md", "sha3")]
    );
    expect(diff.unchanged).toBe(1);
    expect(diff.toUpdate.map((u) => u.id)).toEqual(["m2"]);
    expect(diff.toInsert.map((d) => d.externalRef)).toEqual(["c.md"]);
  });
});

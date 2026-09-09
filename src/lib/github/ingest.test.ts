import { describe, expect, it } from "vitest";
import { buildCommitJournal, selectMarkdownFiles } from "./ingest";
import { MAX_GITHUB_MD_FILES } from "@/lib/validation";

const blob = (path: string, size = 100) => ({ path, type: "blob", sha: `sha-${path}`, size });

describe("selectMarkdownFiles", () => {
  it("ne retient que les blobs .md et .markdown", () => {
    const selected = selectMarkdownFiles([
      blob("README.md"),
      blob("notes.markdown"),
      blob("src/index.ts"),
      { path: "docs", type: "tree", sha: "t" },
    ]);
    expect(selected.map((e) => e.path)).toEqual(["README.md", "notes.markdown"]);
  });

  it("place le README racine en premier, puis trie par profondeur puis alphabétiquement", () => {
    const selected = selectMarkdownFiles([
      blob("docs/z.md"),
      blob("docs/a.md"),
      blob("ARCHITECTURE.md"),
      blob("README.md"),
      blob("docs/deep/x.md"),
    ]);
    expect(selected.map((e) => e.path)).toEqual([
      "README.md",
      "ARCHITECTURE.md",
      "docs/a.md",
      "docs/z.md",
      "docs/deep/x.md",
    ]);
  });

  it("exclut le boilerplate identique d'un projet à l'autre mais garde CHANGELOG", () => {
    const selected = selectMarkdownFiles([
      blob("LICENSE.md"),
      blob("CONTRIBUTING.md"),
      blob("CODE_OF_CONDUCT.md"),
      blob("SECURITY.md"),
      blob("CHANGELOG.md"),
    ]);
    expect(selected.map((e) => e.path)).toEqual(["CHANGELOG.md"]);
  });

  it("exclut les répertoires de dépendances et d'artefacts, à la racine comme en profondeur", () => {
    const selected = selectMarkdownFiles([
      blob("node_modules/pkg/README.md"),
      blob("packages/app/node_modules/x/README.md"),
      blob("dist/out.md"),
      blob("build/b.md"),
      blob("vendor/v.md"),
      blob(".github/PULL_REQUEST_TEMPLATE.md"),
      blob("docs/vrai.md"),
    ]);
    expect(selected.map((e) => e.path)).toEqual(["docs/vrai.md"]);
  });

  it("ignore un fichier au-delà du plafond de taille plutôt que de le tronquer", () => {
    const selected = selectMarkdownFiles([blob("gros.md", 200 * 1024), blob("petit.md", 500)]);
    expect(selected.map((e) => e.path)).toEqual(["petit.md"]);
  });

  it("plafonne le nombre de fichiers retenus", () => {
    const many = Array.from({ length: MAX_GITHUB_MD_FILES + 20 }, (_, i) =>
      blob(`docs/${String(i).padStart(3, "0")}.md`)
    );
    expect(selectMarkdownFiles(many)).toHaveLength(MAX_GITHUB_MD_FILES);
  });
});

describe("buildCommitJournal", () => {
  const commit = (message: string, date = "2026-08-29T09:00:00Z", authorName: string | null = "Alix") => ({
    sha: `sha-${message}`,
    message,
    authorName,
    date,
  });

  it("écrit une entrée par commit avec date, auteur, nom et description", () => {
    const journal = buildCommitJournal([
      commit("feat: contexte d'épisode\n\nLe générateur ne savait pas où il en était."),
    ]);
    expect(journal).toBe(
      "## 2026-08-29 — Alix\nfeat: contexte d'épisode\n\nLe générateur ne savait pas où il en était."
    );
  });

  it("omet la description quand le message n'a qu'une ligne", () => {
    expect(buildCommitJournal([commit("feat: une vraie fonctionnalité")])).toBe(
      "## 2026-08-29 — Alix\nfeat: une vraie fonctionnalité"
    );
  });

  it("écarte les noms d'un seul mot sans description", () => {
    expect(buildCommitJournal([commit("wip"), commit("fix"), commit("up"), commit("typo")])).toBe("");
  });

  it("garde un nom d'un seul mot s'il porte une description", () => {
    const journal = buildCommitJournal([commit("wip\n\nEn fait il se passe quelque chose ici.")]);
    expect(journal).toContain("En fait il se passe quelque chose ici.");
  });

  it("écarte les commits de merge sans description", () => {
    expect(buildCommitJournal([commit("Merge pull request #1 from alix/feature")])).toBe("");
  });

  it("sépare les entrées par une ligne vide et conserve l'ordre reçu", () => {
    const journal = buildCommitJournal([
      commit("feat: le second", "2026-08-29T09:00:00Z"),
      commit("feat: le premier", "2026-08-28T09:00:00Z"),
    ]);
    expect(journal).toBe("## 2026-08-29 — Alix\nfeat: le second\n\n## 2026-08-28 — Alix\nfeat: le premier");
  });

  it("remplace un auteur manquant par une mention neutre", () => {
    expect(buildCommitJournal([commit("feat: un truc", "2026-08-29T09:00:00Z", null)])).toContain("— auteur inconnu");
  });
});

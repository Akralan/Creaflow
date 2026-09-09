import { MAX_GITHUB_FILE_BYTES, MAX_GITHUB_MD_FILES } from "@/lib/validation";
import type { GithubCommit, GithubTreeEntry } from "./client";

/** Valeur réservée d'`externalRef` pour le journal de commits — un seul par source. */
export const COMMITS_EXTERNAL_REF = "__commits__";

const EXCLUDED_DIRECTORIES = ["node_modules", "dist", "build", "vendor", ".github"];

/** Boilerplate identique d'un projet à l'autre : ces textes ne disent rien sur CE projet et ne
 *  feraient que diluer le corpus. CHANGELOG.md est délibérément absent de cette liste — c'est de la
 *  vraie matière datée. */
const EXCLUDED_BASENAMES = new Set(["license.md", "code_of_conduct.md", "contributing.md", "security.md"]);

function depth(path: string): number {
  return path.split("/").length - 1;
}

function isInExcludedDirectory(path: string): boolean {
  // Tous les segments sauf le dernier (le nom de fichier) — attrape aussi bien "node_modules/x.md"
  // que "packages/app/node_modules/x.md".
  return path
    .split("/")
    .slice(0, -1)
    .some((segment) => EXCLUDED_DIRECTORIES.includes(segment));
}

export function selectMarkdownFiles(entries: GithubTreeEntry[]): GithubTreeEntry[] {
  const candidates = entries.filter((entry) => {
    if (entry.type !== "blob") return false;
    const lower = entry.path.toLowerCase();
    if (!lower.endsWith(".md") && !lower.endsWith(".markdown")) return false;
    if (isInExcludedDirectory(lower)) return false;
    if (EXCLUDED_BASENAMES.has(lower.slice(lower.lastIndexOf("/") + 1))) return false;
    // Ignoré, jamais tronqué : un .md coupé au milieu produirait de la matière trompeuse.
    if (entry.size !== undefined && entry.size > MAX_GITHUB_FILE_BYTES) return false;
    return true;
  });

  candidates.sort((a, b) => {
    const aIsRootReadme = a.path.toLowerCase() === "readme.md";
    const bIsRootReadme = b.path.toLowerCase() === "readme.md";
    if (aIsRootReadme !== bIsRootReadme) return aIsRootReadme ? -1 : 1;
    const depthDiff = depth(a.path) - depth(b.path);
    if (depthDiff !== 0) return depthDiff;
    return a.path.localeCompare(b.path);
  });

  return candidates.slice(0, MAX_GITHUB_MD_FILES);
}

/** Noms de commit qui ne portent aucune information exploitable. Écartés seulement s'ils n'ont pas
 *  de description : "wip" suivi d'un paragraphe explicatif reste de la matière. */
const TRIVIAL_NAMES = new Set(["wip", "fix", "up", "update", "typo", "cleanup", "misc"]);

/**
 * Journal Markdown à partir des commits, du plus récent au plus ancien : une entrée par commit avec
 * sa date, son auteur, son nom (première ligne du message) et sa description (le reste).
 *
 * Les fichiers touchés ne sont volontairement pas ingérés : ils ne sont pas dans la réponse de
 * l'endpoint de liste (il faudrait un appel par commit) et n'apportent rien de racontable — le
 * « pourquoi » est dans le message.
 */
export function buildCommitJournal(commits: GithubCommit[]): string {
  return commits
    .map((commit) => {
      const [firstLine, ...rest] = commit.message.split("\n");
      return { ...commit, name: firstLine.trim(), description: rest.join("\n").trim() };
    })
    .filter((commit) => {
      if (!commit.name) return false;
      if (commit.description) return true;
      if (commit.name.startsWith("Merge ")) return false;
      return !TRIVIAL_NAMES.has(commit.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    })
    .map((commit) => {
      const header = `## ${commit.date.slice(0, 10)} — ${commit.authorName ?? "auteur inconnu"}\n${commit.name}`;
      return commit.description ? `${header}\n\n${commit.description}` : header;
    })
    .join("\n\n");
}

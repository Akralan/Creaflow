/**
 * Lien de dépôt collé sur la landing → "propriétaire/dépôt" (docs/SPEC_ENTREE_PAR_LE_REPO.md §2).
 * Accepte "github.com/a/b", "https://github.com/a/b(.git)", "www.github.com/a/b/tree/main" et "a/b".
 * Rien d'autre : un autre hôte, un chemin incomplet ou des caractères hors des règles de GitHub → null.
 */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;

export function parseRepoUrl(input: string): { owner: string; repo: string; fullName: string } | null {
  let text = input.trim();
  if (!text) return null;
  text = text.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  let path = text;
  if (/^github\.com\//i.test(text)) path = text.slice("github.com/".length);
  else if (text.includes(".") && text.split("/")[0].includes(".")) return null; // un autre hôte
  const [owner, rawRepo] = path.split(/[/?#]/).length >= 2 ? path.split("/") : [];
  if (!owner || !rawRepo) return null;
  const repo = rawRepo.replace(/\.git$/i, "").split(/[?#]/)[0];
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === "." || repo === "..") return null;
  return { owner, repo, fullName: `${owner}/${repo}` };
}

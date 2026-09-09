import {
  fetchBlobText,
  fetchTree,
  listCommits,
  listPublicRepos,
  GithubAuthError,
} from "@/lib/github/client";
import { buildCommitJournal, COMMITS_EXTERNAL_REF, selectMarkdownFiles } from "@/lib/github/ingest";
import { getValidProviderAccessToken } from "@/lib/services/oauthAccountService";
import { toCandidate, type GithubCandidateMeta } from "./githubMapping";
import type { FetchedDocuments, IncomingDoc, MaterialSourceRow, SourceConnector } from "./types";

/** Passe par le service commun plutôt que de lire la ligne : GitHub n'a rien à rafraîchir, mais
 *  c'est la règle pour tous les connecteurs, et une exception ici serait recopiée par le suivant. */
const getAccessToken = (userId: string) => getValidProviderAccessToken(userId, "github");

async function collectDocs(token: string, fullName: string, branch: string): Promise<FetchedDocuments> {
  const { entries, truncated } = await fetchTree(token, fullName, branch);
  const selected = selectMarkdownFiles(entries);

  const docs: IncomingDoc[] = [];
  for (const entry of selected) {
    // Séquentiel plutôt qu'un Promise.all : 50 blobs en parallèle sur le quota GitHub d'un
    // utilisateur qui peut avoir plusieurs dépôts en cours d'ingestion, pour aucun gain perceptible.
    const rawText = await fetchBlobText(token, fullName, entry.sha);
    if (!rawText.trim()) continue; // un .md vide n'est pas de la matière
    docs.push({ externalRef: entry.path, externalChecksum: entry.sha, title: entry.path, rawText });
  }

  const commits = await listCommits(token, fullName, branch);
  const journal = buildCommitJournal(commits);
  const headSha = commits[0]?.sha ?? null;
  if (journal && headSha) {
    docs.push({
      externalRef: COMMITS_EXTERNAL_REF,
      externalChecksum: headSha,
      title: `Journal de commits — ${fullName}`,
      rawText: journal,
    });
  }

  return { docs, cursor: headSha, truncated };
}

export const githubConnector: SourceConnector<GithubCandidateMeta> = {
  type: "github_repo",
  displayName: "GitHub",

  emptyMessage: "Ce dépôt ne contient ni fichier .md ni commit exploitable.",
  truncatedMessage: "Dépôt volumineux : l'arbre GitHub a été tronqué, ingestion partielle.",

  // Dépôt passé en privé ou supprimé → "error" ; token révoqué → "needs_reconnect".
  isAuthError: (error) => error instanceof GithubAuthError,

  async assertReady(userId) {
    await getAccessToken(userId);
  },

  async listCandidates(userId) {
    const token = await getAccessToken(userId);
    return (await listPublicRepos(token)).map(toCandidate);
  },

  async fetchDocuments(userId, source: MaterialSourceRow) {
    const token = await getAccessToken(userId);
    const branch = (source.config as { defaultBranch?: string }).defaultBranch ?? "main";
    return collectDocs(token, source.label, branch);
  },
};

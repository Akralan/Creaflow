import { eq } from "drizzle-orm";
import { db } from "@/db";
import { githubAccounts } from "@/db/schema";
import {
  fetchBlobText,
  fetchTree,
  listCommits,
  listPublicRepos,
  GithubAuthError,
} from "@/lib/github/client";
import { buildCommitJournal, COMMITS_EXTERNAL_REF, selectMarkdownFiles } from "@/lib/github/ingest";
import { ApiError } from "@/lib/api/errors";
import type { FetchedDocuments, IncomingDoc, MaterialSourceRow, SourceConnector } from "./types";

/** `type` et non `interface` : une interface n'est pas assignable à `Record<string, unknown>`, ce
 *  que le registre exige pour stocker des connecteurs aux métadonnées hétérogènes. */
export type GithubCandidateMeta = {
  language: string | null;
  pushedAt: string;
};

async function getAccessToken(userId: string): Promise<string> {
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  if (!account) {
    throw new ApiError(400, "Aucun compte GitHub connecté.");
  }
  return account.accessToken;
}

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

  emptyMessage: "Ce dépôt ne contient ni fichier .md ni commit exploitable.",
  truncatedMessage: "Dépôt volumineux : l'arbre GitHub a été tronqué, ingestion partielle.",

  // Dépôt passé en privé ou supprimé → "error" ; token révoqué → "needs_reconnect".
  isAuthError: (error) => error instanceof GithubAuthError,

  async assertReady(userId) {
    await getAccessToken(userId);
  },

  async listCandidates(userId) {
    const token = await getAccessToken(userId);
    return (await listPublicRepos(token)).map((repo) => ({
      externalId: repo.externalId,
      label: repo.fullName,
      subjectName: repo.name,
      subjectDescription: repo.description,
      config: { defaultBranch: repo.defaultBranch },
      meta: { language: repo.language, pushedAt: repo.pushedAt },
    }));
  },

  async fetchDocuments(userId, source: MaterialSourceRow) {
    const token = await getAccessToken(userId);
    const branch = (source.config as { defaultBranch?: string }).defaultBranch ?? "main";
    return collectDocs(token, source.label, branch);
  },
};

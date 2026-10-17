import { fetchProjectContent, listProjects, LinearAuthError } from "@/lib/linear/client";
import { getValidProviderAccessToken } from "@/lib/services/oauthAccountService";
import { buildUpdateJournal, issueToText, toCandidate, type LinearCandidateMeta } from "./linearMapping";
import type { FetchedDocuments, IncomingDoc, MaterialSourceRow, SourceConnector } from "./types";

const getToken = (userId: string) => getValidProviderAccessToken(userId, "linear");

/** Référence stable du journal, comme COMMITS_EXTERNAL_REF côté GitHub : elle doit rester identique
 *  d'une synchro à l'autre pour que le journal soit mis à jour et non dupliqué. */
export const UPDATES_EXTERNAL_REF = "__project_updates__";
export const DESCRIPTION_EXTERNAL_REF = "__project_description__";

export const linearConnector: SourceConnector<LinearCandidateMeta> = {
  type: "linear_project",
  displayName: "Linear",

  emptyMessage: "This Linear project has no description, no update and no completed issue.",
  truncatedMessage: "Large project: only the most recent issues and updates were ingested.",

  // Projet supprimé ou hors de portée du scope → "error" ; token révoqué → "needs_reconnect".
  isAuthError: (error) => error instanceof LinearAuthError,

  candidateHint: (meta) => {
    const teams = meta.teamNames.length > 0 ? meta.teamNames.join(", ") : null;
    const updated = meta.updatedAt ? `updated on ${meta.updatedAt.slice(0, 10)}` : null;
    return [teams, updated].filter(Boolean).join(" · ");
  },

  picker: {
    emptyMessage: "No Linear project visible on this account.",
    footnote: "We pull the project description, its update log and its completed issues.",
  },

  async assertReady(userId) {
    await getToken(userId);
  },

  async listCandidates(userId) {
    const token = await getToken(userId);
    return (await listProjects(token)).map(toCandidate);
  },

  async fetchDocuments(userId, source: MaterialSourceRow): Promise<FetchedDocuments> {
    const token = await getToken(userId);
    const { project, updates, issues } = await fetchProjectContent(token, source.externalId);
    if (!project) {
      // Le connecteur ne décide pas du statut : renvoyer un corpus vide laisse syncSource porter
      // `emptyMessage`, comme pour un dépôt sans .md.
      return { docs: [], cursor: null, truncated: false };
    }

    const docs: IncomingDoc[] = [];

    if (project.description?.trim()) {
      docs.push({
        externalRef: DESCRIPTION_EXTERNAL_REF,
        externalChecksum: project.updatedAt,
        title: `Description — ${project.name}`,
        rawText: project.description.trim(),
      });
    }

    const journal = buildUpdateJournal(updates);
    if (journal) {
      docs.push({
        externalRef: UPDATES_EXTERNAL_REF,
        // Le plus récent des updates : le journal change exactement quand il change.
        externalChecksum: updates.reduce((max, u) => (u.createdAt > max ? u.createdAt : max), ""),
        title: `Project log — ${project.name}`,
        rawText: journal,
      });
    }

    for (const issue of issues) {
      const rawText = issueToText(issue);
      docs.push({
        externalRef: `issue:${issue.id}`,
        externalChecksum: issue.updatedAt,
        title: `${issue.identifier} — ${issue.title}`,
        rawText,
      });
    }

    return { docs, cursor: project.updatedAt, truncated: false };
  },
};

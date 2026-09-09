import type { LinearIssue, LinearProject, LinearProjectUpdate } from "@/lib/linear/client";
import type { ConnectorCandidate } from "./types";

/** Traductions Linear ↔ cœur, pures et testées à part — même découpage que `githubMapping.ts`. */

// Alias de type et non interface, cf. NotionCandidateMeta.
export type LinearCandidateMeta = {
  updatedAt: string;
  teamNames: string[];
};

export function toCandidate(project: LinearProject): ConnectorCandidate<LinearCandidateMeta> {
  return {
    externalId: project.id,
    label: project.name,
    subjectName: project.name,
    subjectDescription: project.description,
    config: {},
    meta: { updatedAt: project.updatedAt, teamNames: project.teamNames },
  };
}

/**
 * Les project updates concaténés en un journal ordonné du plus ancien au plus récent.
 *
 * C'est l'équivalent du journal de commits GitHub, et la meilleure matière de ce connecteur : un
 * project update est déjà une phrase écrite pour être lue par un humain, là où un commit est une
 * note technique (docs/SPEC_CONNECTEURS_ET_SUJETS.md §5).
 */
export function buildUpdateJournal(updates: LinearProjectUpdate[]): string {
  const usable = updates.filter((update) => update.body.trim());
  if (usable.length === 0) return "";

  return [...usable]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((update) => {
      const date = update.createdAt.slice(0, 10);
      const author = update.authorName ? ` — ${update.authorName}` : "";
      return `## ${date}${author}\n\n${update.body.trim()}`;
    })
    .join("\n\n");
}

/** Une issue terminée en un document : le titre porte l'anecdote, la description le détail. */
export function issueToText(issue: LinearIssue): string {
  const parts = [`# ${issue.identifier} — ${issue.title}`];
  if (issue.completedAt) parts.push(`Terminée le ${issue.completedAt.slice(0, 10)}.`);
  if (issue.description?.trim()) parts.push(issue.description.trim());
  return parts.join("\n\n");
}

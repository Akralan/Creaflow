import { z } from "zod";
import { MAX_PRODUCTS } from "@/lib/validation";
import type { ConnectorCandidate } from "./types";

/**
 * Traductions entre la forme « dépôt » que consomme RepoPicker et la forme générique
 * `ConnectorCandidate` que manipule le cœur.
 *
 * Module à part, sans accès base ni réseau, pour que ces mappings soient testables : une inversion
 * entre `name` et `fullName` ne casserait aucun type (tous deux `string`) et créerait des sujets
 * nommés « owner/repo ».
 */

/** `type` et non `interface` : une interface n'est pas assignable à `Record<string, unknown>`, ce
 *  que le registre exige pour stocker des connecteurs aux métadonnées hétérogènes. */
export type GithubCandidateMeta = {
  language: string | null;
  pushedAt: string;
};

export const repoPayloadSchema = z.object({
  externalId: z.string().min(1),
  fullName: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  defaultBranch: z.string().min(1),
  language: z.string().nullable(),
  pushedAt: z.string(),
});

export const connectReposSchema = z.object({ repos: z.array(repoPayloadSchema).min(1).max(MAX_PRODUCTS) });

export type RepoPayload = z.infer<typeof repoPayloadSchema>;

export type GithubCandidate = ConnectorCandidate<GithubCandidateMeta>;

/** `label` porte "owner/repo" (identifiant lisible de la source), `subjectName` le nom court du
 *  dépôt (nom du sujet créé) — les confondre nommerait les sujets "owner/repo". */
export function toCandidate(repo: RepoPayload): GithubCandidate {
  return {
    externalId: repo.externalId,
    label: repo.fullName,
    subjectName: repo.name,
    subjectDescription: repo.description,
    config: { defaultBranch: repo.defaultBranch },
    meta: { language: repo.language, pushedAt: repo.pushedAt },
  };
}

export function toRepoPayload(candidate: GithubCandidate): RepoPayload {
  return {
    externalId: candidate.externalId,
    fullName: candidate.label,
    name: candidate.subjectName,
    description: candidate.subjectDescription,
    // `config` est un jsonb côté base, donc `unknown` côté types : une source ingérée avant que la
    // branche soit stockée retombe sur "main", comme fetchDocuments.
    defaultBranch: String(candidate.config.defaultBranch ?? "main"),
    language: candidate.meta.language,
    pushedAt: candidate.meta.pushedAt,
  };
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { githubConnector, type GithubCandidateMeta } from "@/lib/connectors/github";
import { ConnectorRateLimitError } from "@/lib/connectors/errors";
import type { ConnectorCandidate } from "@/lib/connectors/types";
import { createSourcesFromCandidates, listConnectedExternalIds } from "@/lib/services/sourceConnectorService";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { MAX_PRODUCTS } from "@/lib/validation";

/**
 * Surface HTTP du connecteur GitHub : c'est ici que vit la forme "dépôt" que consomme RepoPicker.
 * Un connecteur a le droit d'avoir sa route et son UI de sélection — la synchronisation, elle, est
 * générique (docs/ARCHITECTURE_VERTICALES.md §4, chantier 1). D'où l'import direct de
 * `githubConnector` plutôt que du registre : seule cette route lit ses métadonnées typées.
 */

const repoSchema = z.object({
  externalId: z.string().min(1),
  fullName: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  defaultBranch: z.string().min(1),
  language: z.string().nullable(),
  pushedAt: z.string(),
});

const connectSchema = z.object({ repos: z.array(repoSchema).min(1).max(MAX_PRODUCTS) });

type RepoPayload = z.infer<typeof repoSchema>;

function toCandidate(repo: RepoPayload): ConnectorCandidate<GithubCandidateMeta> {
  return {
    externalId: repo.externalId,
    label: repo.fullName,
    subjectName: repo.name,
    subjectDescription: repo.description,
    config: { defaultBranch: repo.defaultBranch },
    meta: { language: repo.language, pushedAt: repo.pushedAt },
  };
}

export async function GET() {
  try {
    const userId = await requireUserId();
    // `alreadyConnected` : le picker est aussi proposé dans les paramètres, après l'onboarding —
    // reconnecter un dépôt déjà source créerait un sujet doublon (et violerait l'unicité de
    // material_sources), donc l'UI grise ces dépôts au lieu de laisser l'erreur arriver.
    const [candidates, connectedIds] = await Promise.all([
      githubConnector.listCandidates(userId),
      listConnectedExternalIds(userId, githubConnector.type),
    ]);
    const repos = candidates.map((candidate) => ({
      externalId: candidate.externalId,
      fullName: candidate.label,
      name: candidate.subjectName,
      description: candidate.subjectDescription,
      defaultBranch: String(candidate.config.defaultBranch ?? "main"),
      language: candidate.meta.language,
      pushedAt: candidate.meta.pushedAt,
      alreadyConnected: connectedIds.has(candidate.externalId),
    }));
    return NextResponse.json({ repos });
  } catch (error) {
    // Le quota atteint n'est pas une panne : 429 et message daté, pas un 500 "Erreur serveur".
    if (error instanceof ConnectorRateLimitError) {
      return handleApiError(new ApiError(429, error.message));
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Avant toute écriture : sans compte GitHub, on répond 400 plutôt que de créer des sujets dont
    // chaque source porterait une erreur d'accès.
    await githubConnector.assertReady(userId);
    const { repos } = connectSchema.parse(await request.json());
    // Synchrone : l'ingestion est du fetch et de l'écriture, aucun appel LLM (le résumé est laissé
    // au backfill paresseux). L'UI restitue le détail dépôt par dépôt à partir du tableau renvoyé.
    const results = await createSourcesFromCandidates(userId, githubConnector.type, repos.map(toCandidate));
    return NextResponse.json({ results }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

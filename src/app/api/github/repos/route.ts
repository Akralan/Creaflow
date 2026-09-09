import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { githubConnector } from "@/lib/connectors/github";
import { ConnectorRateLimitError } from "@/lib/connectors/errors";
import { connectReposSchema, toCandidate, toRepoPayload } from "@/lib/connectors/githubMapping";
import { createSourcesFromCandidates, listConnectedExternalIds } from "@/lib/services/sourceConnectorService";
import { ApiError, handleApiError } from "@/lib/api/errors";

/**
 * Surface HTTP du connecteur GitHub : c'est ici que vit la forme "dépôt" que consomme RepoPicker.
 * Un connecteur a le droit d'avoir sa route et son UI de sélection — la synchronisation, elle, est
 * générique (docs/ARCHITECTURE_VERTICALES.md §4, chantier 1). D'où l'import direct de
 * `githubConnector` plutôt que du registre : seule cette route lit ses métadonnées typées.
 */

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
      ...toRepoPayload(candidate),
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
    const { repos } = connectReposSchema.parse(await request.json());
    // Synchrone : l'ingestion est du fetch et de l'écriture, aucun appel LLM (le résumé est laissé
    // au backfill paresseux). L'UI restitue le détail dépôt par dépôt à partir du tableau renvoyé.
    const results = await createSourcesFromCandidates(userId, githubConnector.type, repos.map(toCandidate));
    return NextResponse.json({ results }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

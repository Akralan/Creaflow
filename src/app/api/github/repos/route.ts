import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { githubConnector } from "@/lib/connectors/github";
import { ConnectorRateLimitError } from "@/lib/connectors/errors";
import { connectReposSchema, toCandidate, toRepoPayload } from "@/lib/connectors/githubMapping";
import { createSourcesFromCandidates, listConnectedExternalIds } from "@/lib/services/sourceConnectorService";
import { ApiError, handleApiError } from "@/lib/api/errors";

/**
 * HTTP surface of the GitHub connector: this is where the "repository" shape consumed by RepoPicker lives.
 * A connector is allowed to have its own route and selection UI — synchronisation itself is
 * generic (docs/ARCHITECTURE_VERTICALES.md §4, chantier 1). Hence the direct import of
 * `githubConnector` rather than the registry: only this route reads its typed metadata.
 */

export async function GET() {
  try {
    const userId = await requireUserId();
    // `alreadyConnected`: the picker is also offered in settings, after onboarding —
    // reconnecting a repository that is already a source would create a duplicate topic (and violate the uniqueness of
    // material_sources), so the UI greys out these repositories instead of letting the error arrive.
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
    // Hitting the quota is not an outage: 429 and a dated message, not a 500 "Server error".
    if (error instanceof ConnectorRateLimitError) {
      return handleApiError(new ApiError(429, error.message));
    }
    // Token revoked or expired: needs reconnecting, not an outage (it used to be a 500 "Server error"
    // displayed as "no repository found", observed on 2026-10-17).
    if (githubConnector.isAuthError(error)) {
      return handleApiError(new ApiError(409, (error as Error).message));
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Before any write: without a GitHub account, respond 400 rather than creating topics whose
    // every source would carry an access error.
    await githubConnector.assertReady(userId);
    const { repos } = connectReposSchema.parse(await request.json());
    // Synchronous: ingestion is fetch and write, no LLM call (the summary is left
    // to the lazy backfill). The UI reports the per-repository detail from the returned array.
    const results = await createSourcesFromCandidates(userId, githubConnector.type, repos.map(toCandidate));
    return NextResponse.json({ results }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { getConnector } from "@/lib/connectors/registry";
import { ConnectorRateLimitError } from "@/lib/connectors/errors";
import type { MaterialSourceType } from "@/lib/connectors/types";
import { createSourcesFromCandidates, listConnectedSources } from "@/lib/services/sourceConnectorService";
import { ApiError, handleApiError } from "@/lib/api/errors";

/**
 * Common HTTP surface of the material connectors: list what can be connected, then connect it.
 *
 * Unlike `/api/github/repos`, which carries the "repository" shape expected by RepoPicker, this
 * route knows no provider: it resolves the connector through the registry and only exposes what
 * `ConnectorCandidate` guarantees, plus a context line that the connector composes itself.
 */

/** The URL segment is not the source type: "notion" reads better than "notion_page" in
 *  a URL, and that is what `oauthAccounts.provider` already carries. */
const TYPE_BY_PROVIDER: Record<string, MaterialSourceType> = {
  github: "github_repo",
  notion: "notion_page",
  linear: "linear_project",
};

function resolve(provider: string) {
  const type = TYPE_BY_PROVIDER[provider];
  if (!type) {
    throw new ApiError(404, "This provider does not offer a material source.");
  }
  return { type, connector: getConnector(type) };
}

const connectSchema = z.object({
  candidates: z
    .array(
      z.object({
        externalId: z.string().min(1),
        label: z.string().min(1),
        subjectName: z.string().min(1),
        subjectDescription: z.string().nullable(),
        config: z.record(z.string(), z.unknown()),
        // Le projet existant que la source rejoint (docs/SPEC_RATTACHEMENT_SOURCES.md). Absent : un
        // sujet par candidat, le chemin de l'onboarding et de Settings › Catalogue.
        productId: z.uuid().optional(),
      })
    )
    .min(1),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  // Outside the try: the catch must recognise the provider's own access error.
  let resolvedConnector: ReturnType<typeof getConnector> | undefined;
  try {
    const userId = await requireUserId();
    const { provider } = await params;
    const { type, connector } = resolve(provider);
    resolvedConnector = connector;

    // `alreadyConnected`: reconnecting an already connected source would create a duplicate topic and
    // violate the uniqueness of material_sources — the screen greys them out rather than letting the error
    // arrive after the fact.
    const [candidates, connected] = await Promise.all([
      connector.listCandidates(userId),
      listConnectedSources(userId, type),
    ]);

    return NextResponse.json({
      displayName: connector.displayName,
      emptyMessage: connector.picker?.emptyMessage ?? "Nothing to connect on this account.",
      footnote: connector.picker?.footnote ?? "",
      candidates: candidates.map((candidate) => ({
        externalId: candidate.externalId,
        label: candidate.label,
        subjectName: candidate.subjectName,
        subjectDescription: candidate.subjectDescription,
        config: candidate.config,
        hint: connector.candidateHint?.(candidate.meta) ?? null,
        alreadyConnected: connected.has(candidate.externalId),
        // Le projet qui lit déjà ce candidat : le panneau de Business context l'affiche sur la ligne grisée.
        connectedTo: connected.get(candidate.externalId) ?? null,
      })),
    });
  } catch (error) {
    // Hitting the quota is not an outage: 429 and a dated message, not a 500 "Server error".
    if (error instanceof ConnectorRateLimitError) {
      return handleApiError(new ApiError(429, error.message));
    }
    // Access revoked or expired: needs reconnecting, not an outage.
    if (resolvedConnector?.isAuthError(error)) {
      return handleApiError(new ApiError(409, (error as Error).message));
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const userId = await requireUserId();
    const { provider } = await params;
    const { type, connector } = resolve(provider);

    // Before any write: without a connected account, respond with an error rather than creating
    // topics whose every source would immediately carry an access fault.
    await connector.assertReady(userId);

    const { candidates } = connectSchema.parse(await request.json());
    // Synchronous: ingestion is fetch and write, no LLM call (the summary is left
    // to the lazy backfill). The screen reports the detail source by source.
    const results = await createSourcesFromCandidates(
      userId,
      type,
      candidates.map((candidate) => ({ ...candidate, meta: {} }))
    );
    return NextResponse.json({ results }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { getConnector } from "@/lib/connectors/registry";
import { ConnectorRateLimitError } from "@/lib/connectors/errors";
import type { MaterialSourceType } from "@/lib/connectors/types";
import { createSourcesFromCandidates, listConnectedExternalIds } from "@/lib/services/sourceConnectorService";
import { ApiError, handleApiError } from "@/lib/api/errors";

/**
 * Surface HTTP commune des connecteurs de matière : lister ce qu'on peut brancher, puis le brancher.
 *
 * Contrairement à `/api/github/repos`, qui porte la forme « dépôt » attendue par RepoPicker, cette
 * route ne connaît aucun fournisseur : elle résout le connecteur par le registre et n'expose que ce
 * que `ConnectorCandidate` garantit, plus une ligne de contexte que le connecteur compose lui-même.
 */

/** Le segment d'URL n'est pas le type de source : "notion" est plus lisible que "notion_page" dans
 *  une URL, et c'est ce que porte déjà `oauthAccounts.provider`. */
const TYPE_BY_PROVIDER: Record<string, MaterialSourceType> = {
  github: "github_repo",
  notion: "notion_page",
  linear: "linear_project",
};

function resolve(provider: string) {
  const type = TYPE_BY_PROVIDER[provider];
  if (!type) {
    throw new ApiError(404, "Ce fournisseur ne propose pas de source de matière.");
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
      })
    )
    .min(1),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const userId = await requireUserId();
    const { provider } = await params;
    const { type, connector } = resolve(provider);

    // `alreadyConnected` : rebrancher une source déjà branchée créerait un sujet doublon et
    // violerait l'unicité de material_sources — l'écran les grise plutôt que de laisser l'erreur
    // arriver après coup.
    const [candidates, connectedIds] = await Promise.all([
      connector.listCandidates(userId),
      listConnectedExternalIds(userId, type),
    ]);

    return NextResponse.json({
      displayName: connector.displayName,
      emptyMessage: connector.picker?.emptyMessage ?? "Rien à brancher sur ce compte.",
      footnote: connector.picker?.footnote ?? "",
      candidates: candidates.map((candidate) => ({
        externalId: candidate.externalId,
        label: candidate.label,
        subjectName: candidate.subjectName,
        subjectDescription: candidate.subjectDescription,
        config: candidate.config,
        hint: connector.candidateHint?.(candidate.meta) ?? null,
        alreadyConnected: connectedIds.has(candidate.externalId),
      })),
    });
  } catch (error) {
    // Le quota atteint n'est pas une panne : 429 et message daté, pas un 500 « Erreur serveur ».
    if (error instanceof ConnectorRateLimitError) {
      return handleApiError(new ApiError(429, error.message));
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  try {
    const userId = await requireUserId();
    const { provider } = await params;
    const { type, connector } = resolve(provider);

    // Avant toute écriture : sans compte connecté, on répond en erreur plutôt que de créer des
    // sujets dont chaque source porterait aussitôt un défaut d'accès.
    await connector.assertReady(userId);

    const { candidates } = connectSchema.parse(await request.json());
    // Synchrone : l'ingestion est du fetch et de l'écriture, aucun appel LLM (le résumé est laissé
    // au backfill paresseux). L'écran restitue le détail source par source.
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

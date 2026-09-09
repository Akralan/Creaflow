import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { syncSource } from "@/lib/services/sourceConnectorService";
import { ConnectorRateLimitError } from "@/lib/connectors/errors";
import { ApiError, handleApiError } from "@/lib/api/errors";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json({ report: await syncSource(userId, id) });
  } catch (error) {
    // Le quota atteint n'est pas une panne : 429 et message daté, pas un 500 "Erreur serveur".
    if (error instanceof ConnectorRateLimitError) {
      return handleApiError(new ApiError(429, error.message));
    }
    return handleApiError(error);
  }
}

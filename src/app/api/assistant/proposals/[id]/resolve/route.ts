import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { resolveProposal } from "@/lib/services/assistantService";
import { summarizeMaterialDocument } from "@/lib/services/sourceMaterialService";
import { logger } from "@/lib/logger";

const schema = z.object({
  action: z.enum(["accept", "reject"]),
  fields: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { action, fields } = schema.parse(await request.json());
    const { proposals, summarizeMaterialId } = await resolveProposal(userId, id, action, fields);
    // Résumé orienté potentiel narratif produit hors requête, jamais bloquant — même pipeline que
    // POST /api/materials/upload (docs/SPEC_REDACTEUR_EN_CHEF.md §3.1).
    if (summarizeMaterialId) {
      after(() =>
        summarizeMaterialDocument(summarizeMaterialId).catch((err) =>
          logger.error("Résumé de matière échoué", err, { materialId: summarizeMaterialId })
        )
      );
    }
    return NextResponse.json({ proposals });
  } catch (error) {
    return handleApiError(error);
  }
}

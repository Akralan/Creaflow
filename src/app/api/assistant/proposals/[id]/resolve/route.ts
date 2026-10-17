import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { resolveProposal } from "@/lib/services/assistantService";
import { summarizeMaterialDocument } from "@/lib/services/sourceMaterialService";
import { refreshStaleReaderPortraits } from "@/lib/services/readerPortraitService";
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
    const { proposals, summarizeMaterialId, portraitProductIds } = await resolveProposal(userId, id, action, fields);
    // Summary oriented toward narrative potential, produced outside the request, never blocking — same pipeline as
    // POST /api/materials/upload (docs/SPEC_REDACTEUR_EN_CHEF.md §3.1).
    if (summarizeMaterialId) {
      after(() =>
        summarizeMaterialDocument(summarizeMaterialId).catch((err) =>
          logger.error("Material summary failed", err, { materialId: summarizeMaterialId })
        )
      );
    }
    if (portraitProductIds?.length) {
      // A topic created or modified: portrait to (re)build if missing or if its "Who is it for" changed.
      after(() =>
        refreshStaleReaderPortraits(userId, portraitProductIds).catch((err) => logger.error("Reader portraits failed", err, { userId }))
      );
    }
    return NextResponse.json({ proposals });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { enforceMicroEditQuota } from "@/lib/services/billingService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { instructDesign, toApiDesign } from "@/lib/services/visualDesignService";

const schema = z.object({
  instruction: z.string().trim().min(1).max(600),
  planNumber: z.number().int().positive().nullable().optional(),
});

/** Instruction à l'agent sur la maquette — une micro-retouche (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 « Quota »). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await enforceRateLimit("design-instruct", userId, 20, 60);
    await enforceMicroEditQuota(userId);
    const body = schema.parse(await request.json());
    const { design, rationale } = await instructDesign(userId, id, { instruction: body.instruction, planNumber: body.planNumber ?? null });
    return NextResponse.json({ design: toApiDesign(design), rationale });
  } catch (error) {
    return handleApiError(error);
  }
}

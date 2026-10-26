import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { resolveStyleProposal } from "@/lib/services/styleLearningService";

const schema = z.object({
  action: z.enum(["accept", "reject"]),
  fields: z.record(z.string(), z.unknown()).optional(),
});

/** Accept (with rules possibly unchecked) or reject a style proposal (docs/SPEC_APPRENTISSAGE_STYLE.md §6.3). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { action, fields } = schema.parse(await request.json());
    return NextResponse.json({ proposal: await resolveStyleProposal(userId, id, action, fields) });
  } catch (error) {
    return handleApiError(error);
  }
}

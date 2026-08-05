import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { resolveProposal } from "@/lib/services/assistantService";

const schema = z.object({
  action: z.enum(["accept", "reject"]),
  fields: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { action, fields } = schema.parse(await request.json());
    const { proposals } = await resolveProposal(userId, id, action, fields);
    return NextResponse.json({ proposals });
  } catch (error) {
    return handleApiError(error);
  }
}

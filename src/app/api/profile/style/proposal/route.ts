import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getPendingStyleProposal } from "@/lib/services/styleLearningService";

/** The style learning pass waiting for approval, if any (docs/SPEC_APPRENTISSAGE_STYLE.md §6.1). */
export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({ proposal: await getPendingStyleProposal(userId) });
  } catch (error) {
    return handleApiError(error);
  }
}

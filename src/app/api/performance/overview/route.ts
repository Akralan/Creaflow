import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getPerformanceOverview } from "@/lib/performance/overview";

/** The Performance screen in one read (docs/SPEC_PERFORMANCE.md §5). The week is chosen on the client. */
export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json(await getPerformanceOverview(userId));
  } catch (error) {
    return handleApiError(error);
  }
}

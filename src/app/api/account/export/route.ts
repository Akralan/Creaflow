import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { requireUserId } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { exportAccountData } from "@/lib/services/accountService";

export const runtime = "nodejs";

// Portability (docs/SPEC_LEGAL_EMAIL_RGPD.md §4.3): a JSON, downloaded as is by the client.
// The response is a file, not an API read by the app: hence Content-Disposition.
export async function GET() {
  try {
    const userId = await requireUserId();
    await enforceRateLimit("account-export", userId, 3, 60 * 60);

    const data = await exportAccountData(userId);
    const filename = `buildloud-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

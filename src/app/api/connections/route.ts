import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { socialConnections, postingGoals } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { KNOWN_PLATFORMS, isKnownPlatform } from "@/lib/social/types";
import { hasMetricsFetch } from "@/lib/social";
import { handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const userId = await requireUserId();
    const [connections, goals] = await Promise.all([
      db.query.socialConnections.findMany({
        where: eq(socialConnections.userId, userId),
        columns: { platform: true, connectedAt: true, status: true },
      }),
      db.query.postingGoals.findMany({
        where: eq(postingGoals.userId, userId),
        columns: { platform: true },
      }),
    ]);

    // The platforms tracked by the profile are those with a defined goal, unioned with
    // platforms already connected. Before onboarding (no goal, no connection —
    // the onboarding "networks" step has no platform suggestion yet as long as
    // the conversational chat does not exist), we fall back to the OAuth-connected platforms.
    const goalOrConnectionPlatforms = [...goals.map((g) => g.platform), ...connections.map((c) => c.platform)].filter(isKnownPlatform);
    const platforms = new Set<string>(
      goalOrConnectionPlatforms.length > 0
        ? goalOrConnectionPlatforms
        : KNOWN_PLATFORMS.filter((p) => p.hasOAuth).map((p) => p.key)
    );

    const status = Array.from(platforms).map((platform) => {
      const found = connections.find((c) => c.platform === platform);
      return {
        platform,
        connected: Boolean(found),
        connectedAt: found?.connectedAt ?? null,
        status: found?.status ?? null,
        hasMetricsFetch: hasMetricsFetch(platform),
      };
    });

    return NextResponse.json({ connections: status });
  } catch (error) {
    return handleApiError(error);
  }
}

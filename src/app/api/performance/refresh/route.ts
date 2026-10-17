import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { socialConnections } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { hasMetricsFetch } from "@/lib/social";
import { fetchAndMatchPostsForUser } from "@/lib/services/postMetricsFetchService";
import { ApiError, handleApiError } from "@/lib/api/errors";

/**
 * Lazy trigger point for metrics retrieval (docs/SPEC_METRIQUES_AUTO.md §7.5) —
 * called when the /performance page mounts, no cron (none exists in this repo). Each
 * connected platform is fetched independently via Promise.allSettled: a platform
 * failing (e.g. LinkedIn not validated, see lib/social/linkedin.ts) must never block the others.
 * Reweighting is evaluated only once, after all platforms, because it aggregates the
 * signal across all of them (ContentCategory.weight is global, not per platform).
 */
export async function POST() {
  try {
    const userId = await requireUserId();

    const connections = await db.query.socialConnections.findMany({
      where: eq(socialConnections.userId, userId),
      columns: { platform: true },
    });
    const platforms = connections.map((c) => c.platform).filter(hasMetricsFetch);

    const settled = await Promise.allSettled(platforms.map((platform) => fetchAndMatchPostsForUser(userId, platform)));

    const results = settled.map((outcome, i) => ({
      platform: platforms[i],
      updated: outcome.status === "fulfilled" ? outcome.value.updated : 0,
      candidatesCreated: outcome.status === "fulfilled" ? outcome.value.candidatesCreated : 0,
      error:
        outcome.status === "rejected"
          ? outcome.reason instanceof ApiError
            ? outcome.reason.message
            : "Metrics retrieval failed."
          : null,
    }));

    // No more role rebalancing: their weight only placed free posts, which no longer exist
    // since docs/SPEC_RYTHME_DES_SERIES.md (§7: propose a series rhythm change,
    // upcoming work).

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}

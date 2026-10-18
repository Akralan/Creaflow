import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { fetchAndMatchPostsForUser, platformsToFetch } from "@/lib/services/postMetricsFetchService";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

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
    // The screen calls this once per opening; a script hammering it would run scrapes and paid reads.
    await enforceRateLimit("performance-refresh", userId, 6, 60);

    const platforms = await platformsToFetch(userId);

    const settled = await Promise.allSettled(platforms.map((platform) => fetchAndMatchPostsForUser(userId, platform)));

    const results = settled.map((outcome, i) => ({
      platform: platforms[i],
      updated: outcome.status === "fulfilled" ? outcome.value.updated : 0,
      linked: outcome.status === "fulfilled" ? outcome.value.linked : 0,
      failed: outcome.status === "fulfilled" ? outcome.value.failed : 0,
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

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { socialConnections } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { hasMetricsFetch } from "@/lib/social";
import { fetchAndMatchPostsForUser } from "@/lib/services/postMetricsFetchService";
import { maybeGenerateCategoryReweightProposal } from "@/lib/services/categoryReweightService";
import { ApiError, handleApiError } from "@/lib/api/errors";

/**
 * Point de déclenchement lazy de la récupération de métriques (docs/SPEC_METRIQUES_AUTO.md §7.5) —
 * appelé au montage de la page /performance, pas de cron (aucun n'existe dans ce repo). Chaque
 * plateforme connectée est fetchée indépendamment via Promise.allSettled : une plateforme en
 * échec (ex. LinkedIn non validé, cf. lib/social/linkedin.ts) ne doit jamais bloquer les autres.
 * La re-pondération est évaluée une seule fois, après toutes les plateformes, car elle agrège le
 * signal sur l'ensemble d'entre elles (ContentCategory.weight est global, pas par plateforme).
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
            : "Récupération des métriques échouée."
          : null,
    }));

    await maybeGenerateCategoryReweightProposal(userId);

    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}

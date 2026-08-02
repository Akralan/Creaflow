import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { socialConnections, postingGoals } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { KNOWN_PLATFORMS } from "@/lib/social/types";
import { handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const userId = await requireUserId();
    const [connections, goals] = await Promise.all([
      db.query.socialConnections.findMany({
        where: eq(socialConnections.userId, userId),
        columns: { platform: true, connectedAt: true },
      }),
      db.query.postingGoals.findMany({
        where: eq(postingGoals.userId, userId),
        columns: { platform: true },
      }),
    ]);

    // Les plateformes suivies par le profil sont celles avec un objectif défini, union des
    // plateformes déjà connectées. Avant l'onboarding (aucun objectif, aucune connexion —
    // l'étape "réseaux" de l'onboarding n'a pas encore de suggestion de plateformes tant que
    // le chat conversationnel n'existe pas), on retombe sur les plateformes à connexion OAuth.
    const goalOrConnectionPlatforms = [...goals.map((g) => g.platform), ...connections.map((c) => c.platform)];
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
      };
    });

    return NextResponse.json({ connections: status });
  } catch (error) {
    return handleApiError(error);
  }
}

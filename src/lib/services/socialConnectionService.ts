import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { socialConnections } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { socialProviders, platformLabel } from "@/lib/social";

// Marge de sécurité avant expiration pour déclencher un refresh proactif — même valeur que
// getValidAccessToken (Google Drive), cf. src/lib/services/googleDriveService.ts.
const EXPIRY_MARGIN_MS = 60 * 1000;

export async function getSocialConnectionForUser(userId: string, platform: string) {
  return db.query.socialConnections.findFirst({
    where: and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)),
  });
}

/**
 * Renvoie un access token valide pour (userId, platform), en le rafraîchissant silencieusement
 * si besoin (refresh paresseux à l'usage — aucun cron n'existe dans ce repo, cf.
 * docs/SPEC_METRIQUES_AUTO.md §7.5). Réplique explicitement getValidAccessToken de
 * googleDriveService.ts, généralisé à toute plateforme OAuth dont le provider expose
 * refreshToken().
 *
 * Si accessTokenExpiresAt est null (expiration inconnue pour cette plateforme, ex. Instagram
 * long-lived token), on part du principe que le token en base est valide et on laisse l'appel
 * API échouer explicitement le cas échéant — il n'y a pas de refresh proactif possible dans ce cas.
 */
export async function getValidSocialAccessToken(userId: string, platform: string): Promise<string> {
  const connection = await getSocialConnectionForUser(userId, platform);
  if (!connection) {
    throw new ApiError(409, `Aucune connexion ${platformLabel(platform)} — connecte ton compte pour continuer.`);
  }

  if (!connection.accessTokenExpiresAt || connection.accessTokenExpiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now()) {
    return connection.accessToken;
  }

  const provider = socialProviders[platform];
  if (!provider?.refreshToken || !connection.refreshToken) {
    await db.update(socialConnections).set({ status: "needs_reconnect" }).where(eq(socialConnections.id, connection.id));
    throw new ApiError(409, `Connexion ${platformLabel(platform)} expirée — reconnecte ton compte pour continuer.`);
  }

  try {
    const refreshed = await provider.refreshToken(connection.refreshToken);
    await db
      .update(socialConnections)
      .set({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? connection.refreshToken,
        accessTokenExpiresAt: refreshed.expiresAt ?? null,
        status: "ok",
      })
      .where(eq(socialConnections.id, connection.id));
    return refreshed.accessToken;
  } catch {
    await db.update(socialConnections).set({ status: "needs_reconnect" }).where(eq(socialConnections.id, connection.id));
    throw new ApiError(409, `Connexion ${platformLabel(platform)} expirée — reconnecte ton compte pour continuer.`);
  }
}

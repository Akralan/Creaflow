import { eq } from "drizzle-orm";
import { db } from "@/db";
import { googleDriveConnections } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { exchangeAuthCode, fetchFileMetadata, pingDriveAccess, refreshAccessToken } from "@/lib/googleDrive/client";

// Marge de sécurité avant expiration pour déclencher un refresh proactif.
const EXPIRY_MARGIN_MS = 60 * 1000;

export async function connectGoogleDrive(userId: string, code: string): Promise<{ accessToken: string }> {
  const tokens = await exchangeAuthCode(code);

  const existing = await db.query.googleDriveConnections.findFirst({
    where: eq(googleDriveConnections.userId, userId),
  });

  if (existing) {
    await db
      .update(googleDriveConnections)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.expiresAt,
        status: "ok",
        connectedAt: new Date(),
      })
      .where(eq(googleDriveConnections.id, existing.id));
  } else {
    await db.insert(googleDriveConnections).values({
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.expiresAt,
    });
  }

  return { accessToken: tokens.accessToken };
}

export async function getGoogleDriveConnectionForUser(userId: string) {
  return db.query.googleDriveConnections.findFirst({ where: eq(googleDriveConnections.userId, userId) });
}

export async function disconnectGoogleDrive(userId: string): Promise<void> {
  await db.delete(googleDriveConnections).where(eq(googleDriveConnections.userId, userId));
}

/**
 * Renvoie un access token valide, en le rafraîchissant silencieusement si besoin. Si le refresh
 * échoue (révocation côté utilisateur, cf. §7.3 du cadrage), la connexion est marquée
 * "needs_reconnect" et une erreur explicite est levée plutôt que de rejouer indéfiniment.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const connection = await getGoogleDriveConnectionForUser(userId);
  if (!connection) {
    throw new ApiError(409, "Aucune connexion Google Drive — connecte ton compte pour continuer.");
  }

  if (connection.accessTokenExpiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now()) {
    return connection.accessToken;
  }

  try {
    const refreshed = await refreshAccessToken(connection.refreshToken);
    await db
      .update(googleDriveConnections)
      .set({ accessToken: refreshed.accessToken, accessTokenExpiresAt: refreshed.expiresAt, status: "ok" })
      .where(eq(googleDriveConnections.id, connection.id));
    return refreshed.accessToken;
  } catch {
    await db
      .update(googleDriveConnections)
      .set({ status: "needs_reconnect" })
      .where(eq(googleDriveConnections.id, connection.id));
    throw new ApiError(409, "Connexion Google Drive expirée — reconnecte ton compte pour continuer.");
  }
}

/**
 * Vérification légère avant une opération dépendant de Drive (génération d'image, captioning) —
 * détecte la perte d'accès en amont plutôt qu'en plein milieu du pipeline (§7.3 du cadrage).
 */
export async function checkDriveReachability(userId: string): Promise<boolean> {
  const connection = await getGoogleDriveConnectionForUser(userId);
  if (!connection) return false;

  try {
    const accessToken = await getValidAccessToken(userId);
    const reachable = await pingDriveAccess(accessToken);
    await db
      .update(googleDriveConnections)
      .set({ lastCheckedAt: new Date(), status: reachable ? "ok" : "needs_reconnect" })
      .where(eq(googleDriveConnections.id, connection.id));
    return reachable;
  } catch {
    return false;
  }
}

export type { DriveFileMetadata } from "@/lib/googleDrive/client";
export { fetchFileMetadata };

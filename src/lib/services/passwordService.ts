import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { ApiError } from "@/lib/api/errors";
import { sendEmail } from "@/lib/email";
import { passwordChangedEmail, passwordResetEmail } from "@/lib/email/templates";
import { getContactEmail } from "@/lib/legal/publisher";
import { logger } from "@/lib/logger";

export const RESET_TOKEN_TTL_MINUTES = 60;
export const RESET_PASSWORD_PATH = "/reinitialiser-mot-de-passe";

/** 32 octets aléatoires en base64url : 43 caractères, sans `+`/`/`, sûrs dans une URL. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Seul le hash vit en base : la table ne contient jamais un lien utilisable. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildResetUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}${RESET_PASSWORD_PATH}?token=${encodeURIComponent(token)}`;
}

function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL n'est pas défini dans l'environnement.");
  return url;
}

/**
 * Ne révèle jamais si l'adresse est connue : la route répond pareil dans tous les cas. Un échec
 * d'envoi est logué (donc remonté à Sentry) sans faire échouer la requête, pour la même raison —
 * un 500 ne surviendrait que pour une adresse connue.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // Lu avant toute lecture du compte : une APP_URL absente doit planter pareil pour tout le monde,
  // pas seulement pour les adresses connues (sinon le 500 révélerait qui est inscrit).
  const baseUrl = appUrl();
  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!user) return;

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await db.transaction(async (tx) => {
    // Une demande invalide les précédentes : un seul lien valide à la fois par compte.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashResetToken(token), expiresAt });
  });

  // Envoi non attendu : la réponse ne doit pas durer des centaines de ms de plus pour une adresse
  // connue que pour une inconnue (énumération par le temps de réponse). L'échec est logué (Sentry).
  const content = passwordResetEmail({ resetUrl: buildResetUrl(baseUrl, token), expiresInMinutes: RESET_TOKEN_TTL_MINUTES });
  void sendEmail({ to: email, ...content }).catch((error) => {
    logger.error("Échec d'envoi de l'email de réinitialisation", error, { userId: user.id });
  });
}

/**
 * Remplace le mot de passe, ferme les autres sessions, marque le jeton consommé — dans une seule
 * transaction. Fonctionne aussi pour un compte GitHub/Notion/Linear sans mot de passe : ça lui en
 * crée un (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.3).
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ userId: string }> {
  // Le hash est calculé avant la transaction (~100 ms) pour ne pas tenir la ligne pendant ce temps.
  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  const userId = await db.transaction(async (tx) => {
    // Consommation atomique : l'UPDATE conditionnel est le seul à pouvoir « gagner » le jeton.
    // Deux requêtes simultanées avec le même lien ne passent pas toutes les deux — un SELECT
    // préalable le permettrait, puisque le hash bcrypt laisse une fenêtre de course.
    const [consumed] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hashResetToken(token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .returning({ userId: passwordResetTokens.userId });
    if (!consumed) {
      throw new ApiError(400, "Ce lien n'est plus valide. Refais une demande de réinitialisation.");
    }
    await tx.update(users).set({ passwordHash, sessionsInvalidatedBefore: now }).where(eq(users.id, consumed.userId));
    return consumed.userId;
  });

  await notifyPasswordChanged(userId);
  return { userId };
}

/**
 * Changement depuis l'onglet Compte. `currentPassword` est exigé dès que le compte en a un ; un
 * compte sans mot de passe (identité tierce) en définit un sans rien fournir — il est déjà
 * authentifié par sa session, et c'est le seul chemin pour lui ouvrir la connexion par email.
 */
export async function changePassword(userId: string, currentPassword: string | undefined, newPassword: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { passwordHash: true } });
  if (!user) throw new ApiError(404, "Compte introuvable.");

  if (user.passwordHash) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new ApiError(400, "Le mot de passe actuel est incorrect.");
    }
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, sessionsInvalidatedBefore: new Date() }).where(eq(users.id, userId));
  await notifyPasswordChanged(userId);
}

async function notifyPasswordChanged(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } });
  if (!user) return;
  try {
    await sendEmail({ to: user.email, ...passwordChangedEmail({ contactEmail: getContactEmail() }) });
  } catch (error) {
    logger.error("Échec d'envoi de l'avis de modification de mot de passe", error, { userId });
  }
}

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

/** 32 random bytes in base64url: 43 characters, no `+`/`/`, safe in a URL. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the hash lives in the database: the table never contains a usable link. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildResetUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}${RESET_PASSWORD_PATH}?token=${encodeURIComponent(token)}`;
}

function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL is not set in the environment.");
  return url;
}

/**
 * Never reveals whether the address is known: the route responds the same in every case. A sending
 * failure is logged (hence reported to Sentry) without failing the request, for the same reason —
 * a 500 would only occur for a known address.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  // Read before any account lookup: a missing APP_URL must crash the same way for everyone,
  // not only for known addresses (otherwise the 500 would reveal who is registered).
  const baseUrl = appUrl();
  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!user) return;

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await db.transaction(async (tx) => {
    // A request invalidates the previous ones: only one valid link at a time per account.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hashResetToken(token), expiresAt });
  });

  // Sending is not awaited: the response must not take hundreds of ms longer for a known address
  // than for an unknown one (enumeration by response time). The failure is logged (Sentry).
  const content = passwordResetEmail({ resetUrl: buildResetUrl(baseUrl, token), expiresInMinutes: RESET_TOKEN_TTL_MINUTES });
  void sendEmail({ to: email, ...content }).catch((error) => {
    logger.error("Failed to send the password reset email", error, { userId: user.id });
  });
}

/**
 * Replaces the password, closes the other sessions, marks the token consumed — in a single
 * transaction. Also works for a GitHub/Notion/Linear account with no password: it creates
 * one for it (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.3).
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ userId: string }> {
  // The hash is computed before the transaction (~100 ms) so as not to hold the row during that time.
  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  const userId = await db.transaction(async (tx) => {
    // Atomic consumption: the conditional UPDATE is the only one that can "win" the token.
    // Two simultaneous requests with the same link do not both go through — a prior SELECT
    // would allow it, since the bcrypt hash leaves a race window.
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
      throw new ApiError(400, "This link is no longer valid. Request a new password reset.");
    }
    await tx.update(users).set({ passwordHash, sessionsInvalidatedBefore: now }).where(eq(users.id, consumed.userId));
    return consumed.userId;
  });

  await notifyPasswordChanged(userId);
  return { userId };
}

/**
 * Change from the Account tab. `currentPassword` is required as soon as the account has one; an
 * account without a password (third-party identity) sets one without providing anything — it is already
 * authenticated by its session, and this is the only path to open email sign-in for it.
 */
export async function changePassword(userId: string, currentPassword: string | undefined, newPassword: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { passwordHash: true } });
  if (!user) throw new ApiError(404, "Account not found.");

  if (user.passwordHash) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new ApiError(400, "The current password is incorrect.");
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
    logger.error("Failed to send the password change notice", error, { userId });
  }
}

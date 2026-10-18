import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { loginTokens } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";

/**
 * Connexion par lien dans un email, sans mot de passe (docs/SPEC_ENTREE_PAR_LE_REPO.md §6). Même
 * mécanique que la réinitialisation du mot de passe : seul le hash du jeton est en base, un nouveau
 * lien invalide les précédents du compte, un jeton ne sert qu'une fois — mais il vit 24 h, parce
 * qu'il arrive avec le premier post.
 */
export const LOGIN_LINK_TTL_HOURS = 24;
export const LOGIN_LINK_PATH = "/connexion/lien";

export function generateLoginToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLoginToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildLoginUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}${LOGIN_LINK_PATH}?token=${encodeURIComponent(token)}`;
}

export function appBaseUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL is not set in the environment.");
  return url;
}

/** Crée un lien tout neuf pour le compte et renvoie son URL complète. */
export async function issueLoginLink(userId: string): Promise<string> {
  const baseUrl = appBaseUrl();
  const token = generateLoginToken();
  const expiresAt = new Date(Date.now() + LOGIN_LINK_TTL_HOURS * 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx.update(loginTokens).set({ usedAt: new Date() }).where(and(eq(loginTokens.userId, userId), isNull(loginTokens.usedAt)));
    await tx.insert(loginTokens).values({ userId, tokenHash: hashLoginToken(token), expiresAt });
  });
  return buildLoginUrl(baseUrl, token);
}

/** Consomme le jeton (une seule requête gagne) et renvoie le compte à connecter. */
export async function consumeLoginLink(token: string): Promise<{ userId: string }> {
  const now = new Date();
  const [consumed] = await db
    .update(loginTokens)
    .set({ usedAt: now })
    .where(and(eq(loginTokens.tokenHash, hashLoginToken(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, now)))
    .returning({ userId: loginTokens.userId });
  if (!consumed) throw new ApiError(400, "This link is no longer valid. Ask for a new one.");
  return { userId: consumed.userId };
}

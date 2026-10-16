import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const SESSION_COOKIE = "creaflow_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 jours

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET n'est pas défini dans l'environnement.");
  }
  return secret;
}

export function createSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: SESSION_DURATION_SECONDS });
}

export interface SessionClaims {
  userId: string;
  /** Instant d'émission, en secondes epoch (claim `iat` posé par jsonwebtoken). */
  issuedAt: number;
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, getSecret());
    if (typeof payload === "object" && typeof payload.sub === "string" && typeof payload.iat === "number") {
      return { userId: payload.sub, issuedAt: payload.iat };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Un jeton émis avant `sessionsInvalidatedBefore` est refusé. Comparaison à la seconde, parce que
 * `iat` est en secondes : le jeton émis juste après un reset (même seconde) reste valide, celui
 * émis la seconde d'avant ne l'est plus. Fonction pure, testée à part.
 */
export function isSessionInvalidated(issuedAtSeconds: number, invalidatedBefore: Date | null): boolean {
  if (!invalidatedBefore) return false;
  return issuedAtSeconds < Math.floor(invalidatedBefore.getTime() / 1000);
}

export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Une lecture par clé primaire sur chaque requête authentifiée (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.4) :
 * c'est le prix pour qu'un changement de mot de passe ferme vraiment les autres sessions, et pour
 * qu'un cookie survivant à la suppression du compte ne soit plus reconnu.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = verifySessionToken(token);
  if (!claims) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, claims.userId),
    columns: { sessionsInvalidatedBefore: true },
  });
  if (!user) return null;
  if (isSessionInvalidated(claims.issuedAt, user.sessionsInvalidatedBefore)) return null;
  return claims.userId;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Non authentifié");
    this.name = "UnauthorizedError";
  }
}

export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}

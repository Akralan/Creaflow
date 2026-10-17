import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const SESSION_COOKIE = "creaflow_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set in the environment.");
  }
  return secret;
}

export function createSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: SESSION_DURATION_SECONDS });
}

export interface SessionClaims {
  userId: string;
  /** Issue time, in epoch seconds (`iat` claim set by jsonwebtoken). */
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
 * A token issued before `sessionsInvalidatedBefore` is rejected. Compared to the second, because
 * `iat` is in seconds: a token issued right after a reset (same second) stays valid, one
 * issued the second before no longer is. Pure function, tested separately.
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
 * One primary-key read on every authenticated request (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.4):
 * the price for a password change to really close the other sessions, and for
 * a cookie surviving account deletion to no longer be recognized.
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
    super("Not authenticated");
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

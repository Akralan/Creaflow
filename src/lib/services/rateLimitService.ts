import { createHash } from "crypto";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";

/**
 * Fixed-window rate limiting, Postgres-backed — no Redis in the current infrastructure
 * (see docs/TECH.md §7). Same mechanics as billingService.ts: pure, testable logic
 * (computeWindowStart, resolveRateLimitStatus) separate from the DB-aware code (checkRateLimit).
 *
 * Fixed window rather than sliding: simpler, less precise (up to 2x the displayed limit
 * possible straddling two windows), judged sufficient for anti-abuse/anti-spam protection,
 * not for a precise billing SLA (that is billingService.ts's role).
 */

export interface RateLimitStatus {
  allowed: boolean;
  count: number;
  limit: number;
}

export function computeWindowStart(nowMs: number, windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  return Math.floor(nowMs / windowMs) * windowMs;
}

export function buildBucketKey(scope: string, identifier: string, windowStartMs: number): string {
  return `${scope}:${identifier}:${windowStartMs}`;
}

export function resolveRateLimitStatus(count: number, limit: number): RateLimitStatus {
  return { allowed: count <= limit, count, limit };
}

// Lazy cleanup of expired windows — no cron in this repo (same philosophy as the
// rest of the app). Probabilistic so as not to add a DELETE to every call: the table
// only holds short-lived counters, a frequent purge is not critical.
const CLEANUP_PROBABILITY = 0.01;
// Derived from the current call's windowSeconds (x2, safety margin) rather than a fixed
// constant: a fixed constant would implicitly assume no future call uses a window
// longer than it, and would silently purge a still-active bucket the day that happens
// (e.g. a daily quota added later). With this calculation, retention adjusts itself.
const CLEANUP_RETENTION_FLOOR_MS = 60 * 60 * 1000; // 1h floor, even for very short windows

async function maybeCleanupExpiredBuckets(nowMs: number, windowSeconds: number): Promise<void> {
  if (Math.random() >= CLEANUP_PROBABILITY) return;
  const retentionMs = Math.max(CLEANUP_RETENTION_FLOOR_MS, windowSeconds * 1000 * 2);
  await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.windowStart, new Date(nowMs - retentionMs)));
}

/**
 * Increments the current window's counter for (scope, identifier) and returns its status.
 * `nowMs` is an explicit parameter (not an internal Date.now()) only to stay testable —
 * in real use, always called without passing it (see enforceRateLimit).
 */
export async function checkRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number,
  nowMs: number = Date.now()
): Promise<RateLimitStatus> {
  const windowStartMs = computeWindowStart(nowMs, windowSeconds);
  const key = buildBucketKey(scope, identifier, windowStartMs);

  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ key, count: 1, windowStart: new Date(windowStartMs) })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });

  await maybeCleanupExpiredBuckets(nowMs, windowSeconds);

  return resolveRateLimitStatus(row.count, limit);
}

/**
 * Fingerprint of a personal identifier (email) for the bucket key: the table then contains
 * no plain address, only a hash — which the privacy policy can state
 * without lying. The IP, on the other hand, stays in plain text (useful for diagnosing a burst).
 */
export function pseudonymizeIdentifier(identifier: string): string {
  return createHash("sha256").update(identifier).digest("hex").slice(0, 32);
}

/** To be called at the top of sensitive routes (auth, LLM generation, Stripe actions). */
export async function enforceRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const status = await checkRateLimit(scope, identifier, limit, windowSeconds);
  if (!status.allowed) {
    throw new ApiError(429, "Too many requests. Try again in a few moments.");
  }
}

/**
 * Client IP from `X-Forwarded-For` (set by most hosting platforms —
 * Vercel, Railway, etc.). Trusts this header: in direct self-hosting with no proxy in front of
 * the app, a client could forge it to bypass the per-IP limit — acceptable in v1, the
 * per-user limit (userId) on authenticated routes does not have this problem.
 *
 * Returns `null` if the header is absent rather than a fallback value such as "unknown": such
 * a value would serve as a bucket key shared by ALL clients without the header (deployment
 * with no proxy in front of the app), and a single one exceeding the limit would be enough to block all the
 * others — a self-inflicted denial of service worse than having no per-IP limit. Callers
 * must skip the per-IP check on `null` (see login/route.ts, signup/route.ts).
 */
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || null;
}

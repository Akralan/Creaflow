import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";

/**
 * Rate limiting fenêtre fixe (fixed window), backé Postgres — pas de Redis dans l'infra actuelle
 * (cf. docs/TECH.md §7). Même mécanique que billingService.ts : logique pure et testable
 * (computeWindowStart, resolveRateLimitStatus) séparée du code DB-aware (checkRateLimit).
 *
 * Fenêtre fixe plutôt que glissante : plus simple, moins précis (jusqu'à 2x la limite affichée
 * possible à cheval sur deux fenêtres), jugé suffisant pour de la protection anti-abus/anti-spam,
 * pas pour un SLA de facturation précis (ça, c'est le rôle de billingService.ts).
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

// Nettoyage paresseux des fenêtres expirées — pas de cron dans ce repo (même philosophie que le
// reste de l'app). Probabiliste pour ne pas ajouter un DELETE à chaque appel : la table ne
// contient que des compteurs à courte durée de vie, une purge fréquente n'est pas critique.
const CLEANUP_PROBABILITY = 0.01;
// Dérivée du windowSeconds de l'appel en cours (x2, marge de sécurité) plutôt qu'une constante
// fixe : une constante fixe supposerait implicitement qu'aucun appel futur n'utilise une fenêtre
// plus longue qu'elle, et purgerait silencieusement un bucket encore actif le jour où c'est le cas
// (ex. un quota journalier ajouté plus tard). Avec ce calcul, la rétention s'ajuste d'elle-même.
const CLEANUP_RETENTION_FLOOR_MS = 60 * 60 * 1000; // 1h plancher, même pour des fenêtres très courtes

async function maybeCleanupExpiredBuckets(nowMs: number, windowSeconds: number): Promise<void> {
  if (Math.random() >= CLEANUP_PROBABILITY) return;
  const retentionMs = Math.max(CLEANUP_RETENTION_FLOOR_MS, windowSeconds * 1000 * 2);
  await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.windowStart, new Date(nowMs - retentionMs)));
}

/**
 * Incrémente le compteur de la fenêtre courante pour (scope, identifier) et renvoie son statut.
 * `nowMs` est un paramètre explicite (pas Date.now() interne) uniquement pour rester testable —
 * en usage réel, toujours appelé sans le passer (voir enforceRateLimit).
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

/** À appeler en tête des routes sensibles (auth, génération LLM, actions Stripe). */
export async function enforceRateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<void> {
  const status = await checkRateLimit(scope, identifier, limit, windowSeconds);
  if (!status.allowed) {
    throw new ApiError(429, "Trop de requêtes. Réessaie dans quelques instants.");
  }
}

/**
 * IP client à partir de `X-Forwarded-For` (posé par la plupart des plateformes d'hébergement —
 * Vercel, Railway, etc.). Fait confiance à cet en-tête : en self-hosting direct sans proxy devant
 * l'app, un client pourrait le falsifier pour contourner la limite par IP — acceptable en v1, la
 * limite par utilisateur (userId) sur les routes authentifiées n'a pas ce problème.
 *
 * Renvoie `null` si l'en-tête est absent plutôt qu'une valeur de repli du type "unknown" : une
 * telle valeur servirait de clé de bucket partagée par TOUS les clients sans l'en-tête (déploiement
 * sans proxy devant l'app), et il suffirait qu'un seul dépasse la limite pour bloquer tous les
 * autres — un déni de service auto-infligé pire que l'absence de limite par IP. Les appelants
 * doivent sauter le check par IP sur `null` (voir login/route.ts, signup/route.ts).
 */
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || null;
}

import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, consumedWeeks, scriptGenerationEvents, scriptMicroEditEvents, scripts, subscriptions, subscriptionStatusEnum, users } from "@/db/schema";
import type { Stripe } from "stripe";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { FREE_TRIAL_MICRO_EDIT_LIMIT, FREE_TRIAL_WEEK_LIMIT, getPlan, type PlanId } from "@/lib/billing/plans";

type DbSubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];

// Stripe.Subscription.Status also includes "paused" (pause collection) and an open OtherString
// (future statuses) that our Postgres enum does not model — not offered in v1 (no "pause"
// config on the Customer Portal side). We map them to "past_due": that cuts the quota as a
// precaution (the status is no longer "active") rather than crashing the webhook or storing a
// value outside the enum.
export function toDbSubscriptionStatus(status: Stripe.Subscription.Status): DbSubscriptionStatus {
  const known = subscriptionStatusEnum.enumValues as readonly string[];
  return known.includes(status) ? (status as DbSubscriptionStatus) : "past_due";
}

// Statuses for which a Stripe subscription already exists and is not definitively closed — a new
// Checkout must not be offered (it would create a 2nd Stripe customer/subscription, see
// src/app/api/billing/checkout/route.ts). "canceled" and "incomplete_expired" are deliberately
// excluded: they are the only terminal statuses from which starting over with a new subscription
// makes sense.
export const NON_TERMINAL_SUBSCRIPTION_STATUSES = new Set<DbSubscriptionStatus>([
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "incomplete",
]);

/**
 * Script generation quota (billing Phase 1 docs): pure, testable decision logic (resolveQuotaStatus),
 * separated from the DB-aware code (getQuotaStatus, enforceScriptQuota) that feeds it.
 */

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  planName: string;
  /** Ce que le compteur compte : des semaines de contenu (essai) ou des scripts (abonnement). */
  unit: "weeks" | "scripts";
}

export function resolveQuotaStatus(used: number, limit: number, planName: string, unit: QuotaStatus["unit"] = "scripts"): QuotaStatus {
  return { allowed: used < limit, used, limit, planName, unit };
}

/** Lundi (UTC) de la semaine qui contient `date`, en `YYYY-MM-DD` : la clé d'une semaine de contenu. */
export function weekStartOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export const CUSTOM_QUOTA_NAME = "Custom quota";

/**
 * Applied limit (docs/SPEC_QUOTAS_ADMIN.md): the account's own quota, set from /admin/quotas,
 * replaces the trial's or plan's; null = normal limit.
 */
export function effectiveLimit(normal: { limit: number; planName: string }, custom: number | null | undefined) {
  return custom === null || custom === undefined ? normal : { limit: custom, planName: CUSTOM_QUOTA_NAME };
}

async function customLimits(userId: string) {
  return db.query.users.findFirst({ where: eq(users.id, userId), columns: { scriptLimit: true, microEditLimit: true, weekLimit: true } });
}

export async function getSubscriptionForUser(userId: string) {
  return db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
}

// Counts generation events (scriptGenerationEvents), not `scripts` rows: a regeneration reuses
// the same `scripts` row (same `createdAt`) but must count as a new billed LLM call — see the
// comment on scriptGenerationEvents in schema.ts.
async function countGenerationEvents(userId: string, since?: Date): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(scriptGenerationEvents)
    .where(
      since
        ? and(eq(scriptGenerationEvents.userId, userId), gte(scriptGenerationEvents.createdAt, since))
        : eq(scriptGenerationEvents.userId, userId)
    );
  return value;
}

export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
  const [subscription, custom] = await Promise.all([getSubscriptionForUser(userId), customLimits(userId)]);
  if (subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    const plan = getPlan(subscription.plan as PlanId);
    const periodStart = subscription.currentPeriodStart ?? subscription.createdAt;
    const used = await countGenerationEvents(userId, periodStart);
    const { limit, planName } = effectiveLimit({ limit: plan.scriptsPerMonth, planName: plan.name }, custom?.scriptLimit);
    return resolveQuotaStatus(used, limit, planName, "scripts");
  }
  // No active subscription: the free trial offers weeks of content, for life (no periodic reset), see plans.ts.
  const [{ value: used }] = await db.select({ value: count() }).from(consumedWeeks).where(eq(consumedWeeks.userId, userId));
  const { limit, planName } = effectiveLimit({ limit: FREE_TRIAL_WEEK_LIMIT, planName: "Free trial" }, custom?.weekLimit);
  return resolveQuotaStatus(used, limit, planName, "weeks");
}

/**
 * To be called before any script generation/regeneration (see /api/scripts/* routes).
 *
 * Known limitation accepted in v1: the check (reading the counter) and the event write (in
 * createScriptRecord/updateScriptRecord, after the LLM call) are not atomic — two concurrent
 * requests from the same user, both just under the limit, can both pass before either has
 * committed its event, occasionally exceeding the quota by a few units. Fixing it properly would
 * require a lock held for the whole LLM call (several seconds) — judged worse (DB connections
 * held needlessly) than this occasional, rare overshoot for a monthly quota of 30 to 150 scripts.
 */
export async function enforceScriptQuota(userId: string, target?: { date?: Date; scriptId?: string }): Promise<void> {
  const status = await getQuotaStatus(userId);
  if (status.unit === "weeks") return enforceWeekQuota(userId, status, await targetDate(userId, target));
  if (!status.allowed) {
    throw new ApiError(
      402,
      `Quota reached (${status.used}/${status.limit} scripts — ${status.planName}). Upgrade to a higher plan to keep generating scripts.`
    );
  }
}

/** La semaine visée : celle du créneau du post, sinon celle d'aujourd'hui. */
async function targetDate(userId: string, target?: { date?: Date; scriptId?: string }): Promise<Date> {
  if (target?.date) return target.date;
  if (target?.scriptId) {
    const entry = await db.query.calendarEntries.findFirst({
      where: and(eq(calendarEntries.userId, userId), eq(calendarEntries.scriptId, target.scriptId)),
      columns: { scheduledDate: true },
    });
    if (entry) return entry.scheduledDate;
    // Un script sans créneau : sa semaine est celle où il a été écrit.
    const script = await db.query.scripts.findFirst({ where: and(eq(scripts.id, target.scriptId), eq(scripts.userId, userId)), columns: { createdAt: true } });
    if (script) return script.createdAt;
  }
  return new Date();
}

/**
 * Compte sans abonnement (docs/SPEC_APP_DESIGN_TELLOVO.md E10) : écrire un post d'une semaine déjà entamée
 * est libre ; entamer une nouvelle semaine consomme l'une de celles offertes. La semaine est gravée avant
 * l'appel au modèle — une insertion unique, donc deux requêtes simultanées ne la consomment qu'une fois.
 */
async function enforceWeekQuota(userId: string, status: QuotaStatus, date: Date): Promise<void> {
  const weekStart = weekStartOf(date);
  const already = await db.query.consumedWeeks.findFirst({ where: and(eq(consumedWeeks.userId, userId), eq(consumedWeeks.weekStart, weekStart)), columns: { id: true } });
  if (already) return;
  if (!status.allowed) {
    throw new ApiError(402, `Your ${status.limit === 1 ? "free week is" : `${status.limit} free weeks are`} used. Upgrade to keep your weekly content going.`);
  }
  await db.insert(consumedWeeks).values({ userId, weekStart }).onConflictDoNothing();
}

// Counts micro-edits (scriptMicroEditEvents), a pool separate from the full-generation quota
// above — see the comment on scriptMicroEditEvents in schema.ts.
async function countMicroEditEvents(userId: string, since?: Date): Promise<number> {
  const [{ value }] = await db
    .select({ value: count() })
    .from(scriptMicroEditEvents)
    .where(
      since
        ? and(eq(scriptMicroEditEvents.userId, userId), gte(scriptMicroEditEvents.createdAt, since))
        : eq(scriptMicroEditEvents.userId, userId)
    );
  return value;
}

/** Exact mirror of getQuotaStatus, on the micro-edit pool (docs/SPEC_MATIERE_EDITEUR.md §4.6). */
export async function getMicroEditQuotaStatus(userId: string): Promise<QuotaStatus> {
  const [subscription, custom] = await Promise.all([getSubscriptionForUser(userId), customLimits(userId)]);
  if (subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    const plan = getPlan(subscription.plan as PlanId);
    const periodStart = subscription.currentPeriodStart ?? subscription.createdAt;
    const used = await countMicroEditEvents(userId, periodStart);
    const { limit, planName } = effectiveLimit({ limit: plan.microEditsPerMonth, planName: plan.name }, custom?.microEditLimit);
    return resolveQuotaStatus(used, limit, planName);
  }
  const used = await countMicroEditEvents(userId);
  const { limit, planName } = effectiveLimit({ limit: FREE_TRIAL_MICRO_EDIT_LIMIT, planName: "Free trial" }, custom?.microEditLimit);
  return resolveQuotaStatus(used, limit, planName);
}

/** To be called before any micro-edit (POST /api/scripts/:id/micro-edit). */
export async function enforceMicroEditQuota(userId: string): Promise<void> {
  const status = await getMicroEditQuotaStatus(userId);
  if (!status.allowed) {
    throw new ApiError(
      402,
      `Edit quota reached (${status.used}/${status.limit} — ${status.planName}). Upgrade to a higher plan to continue.`
    );
  }
}

/**
 * upsert called only from the Stripe webhook (checkout.session.completed and
 * customer.subscription.*) — never from a user route, the source of truth for the subscription
 * status is always Stripe, never a local action.
 */
export async function upsertSubscriptionFromStripe(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscription: Stripe.Subscription;
  plan: PlanId;
}): Promise<void> {
  const { userId, stripeCustomerId, stripeSubscription, plan } = params;

  // A deleted account (DELETE /api/account) can still receive an in-flight event — subscription
  // canceled just before, checkout in progress. Without this guard, the insert would violate the
  // foreign key, the webhook would respond 500 and Stripe would replay it for days. We ignore it
  // with a 200.
  const owner = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true } });
  if (!owner) {
    logger.warn("Stripe event received for a deleted account, ignored", { userId, stripeSubscriptionId: stripeSubscription.id });
    return;
  }

  const item = stripeSubscription.items.data[0];
  const values = {
    userId,
    stripeCustomerId,
    stripeSubscriptionId: stripeSubscription.id,
    plan,
    status: toDbSubscriptionStatus(stripeSubscription.status),
    currentPeriodStart: item ? new Date(item.current_period_start * 1000) : null,
    currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    updatedAt: new Date(),
  } as const;

  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({ target: subscriptions.userId, set: values });
}

/** Marks the subscription as canceled without depending on the full payload of the `customer.subscription.deleted`. */
export async function markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
  await db
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

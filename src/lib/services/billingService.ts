import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { scriptGenerationEvents, subscriptions, subscriptionStatusEnum } from "@/db/schema";
import type { Stripe } from "stripe";
import { ApiError } from "@/lib/api/errors";
import { FREE_TRIAL_SCRIPT_LIMIT, getPlan, type PlanId } from "@/lib/billing/plans";

type DbSubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];

// Stripe.Subscription.Status inclut aussi "paused" (pause collection) et un OtherString ouvert
// (statuts futurs) que notre enum Postgres ne modélise pas — non proposé en v1 (pas de config
// "pause" côté Customer Portal). On les fait tomber sur "past_due" : ça coupe le quota par
// prudence (le statut n'est plus "actif") plutôt que de planter le webhook ou de stocker une
// valeur hors enum.
export function toDbSubscriptionStatus(status: Stripe.Subscription.Status): DbSubscriptionStatus {
  const known = subscriptionStatusEnum.enumValues as readonly string[];
  return known.includes(status) ? (status as DbSubscriptionStatus) : "past_due";
}

// Statuts pour lesquels un abonnement Stripe existe déjà et n'est pas définitivement clos — un
// nouveau Checkout ne doit pas être proposé (créerait un 2e customer/2e subscription Stripe, cf.
// src/app/api/billing/checkout/route.ts). "canceled" et "incomplete_expired" sont volontairement
// exclus : ce sont les seuls statuts terminaux d'où repartir sur un abonnement neuf a du sens.
export const NON_TERMINAL_SUBSCRIPTION_STATUSES = new Set<DbSubscriptionStatus>([
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "incomplete",
]);

/**
 * Quota de génération de scripts (docs Phase 1 facturation) : mécanique équivalente à
 * categoryReweightService.ts — logique de décision pure et testable (resolveQuotaStatus),
 * séparée du code DB-aware (getQuotaStatus, enforceScriptQuota) qui l'alimente.
 */

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);

export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  planName: string;
}

export function resolveQuotaStatus(used: number, limit: number, planName: string): QuotaStatus {
  return { allowed: used < limit, used, limit, planName };
}

export async function getSubscriptionForUser(userId: string) {
  return db.query.subscriptions.findFirst({ where: eq(subscriptions.userId, userId) });
}

// Compte les événements de génération (scriptGenerationEvents), pas les lignes `scripts` : une
// régénération réutilise la même ligne `scripts` (même `createdAt`) mais doit compter comme un
// nouvel appel LLM facturé — voir le commentaire sur scriptGenerationEvents dans schema.ts.
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
  const subscription = await getSubscriptionForUser(userId);
  if (subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    const plan = getPlan(subscription.plan as PlanId);
    const periodStart = subscription.currentPeriodStart ?? subscription.createdAt;
    const used = await countGenerationEvents(userId, periodStart);
    return resolveQuotaStatus(used, plan.scriptsPerMonth, plan.name);
  }
  // Pas d'abonnement actif : essai gratuit à vie (pas de reset périodique), cf. plans.ts.
  const used = await countGenerationEvents(userId);
  return resolveQuotaStatus(used, FREE_TRIAL_SCRIPT_LIMIT, "Essai gratuit");
}

/**
 * À appeler avant toute génération/régénération de script (voir routes /api/scripts/*).
 *
 * Limite connue acceptée en v1 : le check (lecture du compteur) et l'écriture de l'événement
 * (dans createScriptRecord/updateScriptRecord, après l'appel LLM) ne sont pas atomiques — deux
 * requêtes concurrentes du même utilisateur, toutes deux juste sous la limite, peuvent passer
 * toutes les deux avant qu'aucune n'ait committé son événement, dépassant ponctuellement le
 * quota de quelques unités. Corriger proprement demanderait un verrou tenu pendant tout l'appel
 * LLM (plusieurs secondes) — jugé pire (connexions DB retenues inutilement) que ce dépassement
 * ponctuel et rare pour un quota mensuel de 30 à 150 scripts.
 */
export async function enforceScriptQuota(userId: string): Promise<void> {
  const status = await getQuotaStatus(userId);
  if (!status.allowed) {
    throw new ApiError(
      402,
      `Quota atteint (${status.used}/${status.limit} scripts — ${status.planName}). Passe à un plan supérieur pour continuer à générer des scripts.`
    );
  }
}

/**
 * upsert appelé uniquement depuis le webhook Stripe (checkout.session.completed et
 * customer.subscription.*) — jamais depuis une route utilisateur, la source de vérité du statut
 * d'abonnement est toujours Stripe, jamais une action locale.
 */
export async function upsertSubscriptionFromStripe(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscription: Stripe.Subscription;
  plan: PlanId;
}): Promise<void> {
  const { userId, stripeCustomerId, stripeSubscription, plan } = params;
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

/** Marque l'abonnement annulé sans dépendre du payload complet de l'event `customer.subscription.deleted`. */
export async function markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
  await db
    .update(subscriptions)
    .set({ status: "canceled", updatedAt: new Date() })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

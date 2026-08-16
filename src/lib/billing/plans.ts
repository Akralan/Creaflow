import type { subscriptionPlanEnum } from "@/db/schema";

export type PlanId = (typeof subscriptionPlanEnum.enumValues)[number];

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Quota de scripts générés/régénérés par cycle de facturation (checkout ou renouvellement). */
  scriptsPerMonth: number;
  /** Prix Stripe (mode "subscription", récurrence mensuelle) — créé côté Stripe Dashboard/CLI. */
  stripePriceIdEnvVar: "STRIPE_PRICE_STARTER" | "STRIPE_PRICE_PRO";
}

// Deux plans en v1 — volontairement simple (pas de palier annuel, pas de add-on à l'usage) tant que
// la conversion self-service n'est pas éprouvée. Les montants affichés (pricing) vivent côté Stripe
// Dashboard, pas ici : ce fichier ne référence que l'ID du Price via une variable d'env, jamais un
// montant en dur, pour ne jamais désynchroniser le code d'un changement de prix fait côté Stripe.
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    scriptsPerMonth: 30,
    stripePriceIdEnvVar: "STRIPE_PRICE_STARTER",
  },
  pro: {
    id: "pro",
    name: "Pro",
    scriptsPerMonth: 150,
    stripePriceIdEnvVar: "STRIPE_PRICE_PRO",
  },
};

// Essai gratuit sans carte bancaire : quota à vie (pas de reset mensuel, pas de ligne `subscriptions`
// tant que l'utilisateur n'a pas payé une fois — cf. billingService.ts).
export const FREE_TRIAL_SCRIPT_LIMIT = 5;

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS[id];
}

export function resolveStripePriceId(id: PlanId): string {
  const envVar = PLANS[id].stripePriceIdEnvVar;
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`${envVar} n'est pas défini dans l'environnement.`);
  }
  return value;
}

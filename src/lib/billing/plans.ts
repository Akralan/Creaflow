import type { subscriptionPlanEnum } from "@/db/schema";

export type PlanId = (typeof subscriptionPlanEnum.enumValues)[number];

export interface PlanDefinition {
  id: PlanId;
  name: string;
  /** Quota of generated/regenerated scripts per billing cycle (checkout or renewal). */
  scriptsPerMonth: number;
  /** Quota of micro-edits (selection→instruction, regenerating a block) per billing cycle —
   *  a separate pool, more generous than scriptsPerMonth (docs/SPEC_MATIERE_EDITEUR.md §4.6): a
   *  micro-edit is a short text LLM call on a single block, much cheaper than a full multi-field
   *  structured generation. */
  microEditsPerMonth: number;
  /** Stripe price ("subscription" mode, monthly recurrence) — created in the Stripe Dashboard/CLI. */
  stripePriceIdEnvVar: "STRIPE_PRICE_STARTER" | "STRIPE_PRICE_PRO";
}

// Two plans in v1 — deliberately simple (no annual tier, no usage-based add-on) until self-service
// conversion is proven. The displayed amounts (pricing) live in the Stripe Dashboard, not here:
// this file only references the Price ID through an env variable, never a hard-coded amount, so
// the code never drifts out of sync with a price change made on the Stripe side.
export const PLANS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    scriptsPerMonth: 30,
    microEditsPerMonth: 150, // x5 — initial estimate, to be recalibrated on real per-provider costs
    stripePriceIdEnvVar: "STRIPE_PRICE_STARTER",
  },
  pro: {
    id: "pro",
    name: "Pro",
    scriptsPerMonth: 150,
    microEditsPerMonth: 600, // x4
    stripePriceIdEnvVar: "STRIPE_PRICE_PRO",
  },
};

// Free trial with no credit card: lifetime quota (no monthly reset, no `subscriptions` row until
// the user has paid once — see billingService.ts).
export const FREE_TRIAL_SCRIPT_LIMIT = 5;
export const FREE_TRIAL_MICRO_EDIT_LIMIT = 30;

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS[id];
}

export function resolveStripePriceId(id: PlanId): string {
  const envVar = PLANS[id].stripePriceIdEnvVar;
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`${envVar} is not set in the environment.`);
  }
  return value;
}

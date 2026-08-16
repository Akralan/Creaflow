import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { getStripeClient } from "@/lib/billing/stripeClient";
import { getSubscriptionForUser } from "@/lib/services/billingService";

export const runtime = "nodejs";

function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL n'est pas défini dans l'environnement.");
  return url;
}

// Portail Stripe (gestion moyen de paiement, factures, résiliation). Pas de changement de plan
// self-service en v1 — cf. commentaire sur upsertSubscriptionFromStripe dans billingService.ts,
// pour éviter de désynchroniser `subscriptions.plan` (fixé une fois via metadata à la création).
export async function POST() {
  try {
    const userId = await requireUserId();
    const subscription = await getSubscriptionForUser(userId);
    if (!subscription) {
      throw new ApiError(404, "Aucun abonnement Stripe pour ce compte — souscris d'abord à un plan.");
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl()}/settings?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}

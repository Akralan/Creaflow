import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { getStripeClient } from "@/lib/billing/stripeClient";
import { getSubscriptionForUser } from "@/lib/services/billingService";

export const runtime = "nodejs";

function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL is not set in the environment.");
  return url;
}

// Stripe portal (payment method, invoices, cancellation). No self-service plan change in v1 —
// see the comment on upsertSubscriptionFromStripe in billingService.ts, to avoid desynchronizing
// `subscriptions.plan` (set once via metadata at creation).
export async function POST() {
  try {
    const userId = await requireUserId();
    const subscription = await getSubscriptionForUser(userId);
    if (!subscription) {
      throw new ApiError(404, "No Stripe subscription for this account — subscribe to a plan first.");
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

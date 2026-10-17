import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { getStripeClient } from "@/lib/billing/stripeClient";
import { resolveStripePriceId } from "@/lib/billing/plans";
import { getSubscriptionForUser, NON_TERMINAL_SUBSCRIPTION_STATUSES } from "@/lib/services/billingService";

export const runtime = "nodejs";

const schema = z.object({ plan: z.enum(["starter", "pro"]) });

function appUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL is not set in the environment.");
  return url;
}

// Creates a Stripe Checkout session ("subscription" mode) and returns its redirect URL — the
// front end navigates to session.url, no Stripe.js integration on the client in v1. The local
// `subscriptions` row is never created here: it only exists after the checkout.session.completed
// webhook (source of truth = Stripe, see billingService.ts).
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { plan } = schema.parse(await request.json());

    // Block as soon as a Stripe subscription exists and is not definitively closed (not only
    // active/trialing): otherwise a new Checkout creates a 2nd Stripe customer (no `customer:`
    // reused here) and a 2nd subscription, with the 1st one still existing on the Stripe side
    // without the app ever referencing it again (the upsert overwrites the local row on userId).
    const existing = await getSubscriptionForUser(userId);
    if (existing && NON_TERMINAL_SUBSCRIPTION_STATUSES.has(existing.status)) {
      throw new ApiError(
        409,
        "This account already has a subscription in progress. Use the billing portal to fix your payment method or cancel it."
      );
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new ApiError(404, "User not found.");

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: userId,
      customer_email: user.email,
      line_items: [{ price: resolveStripePriceId(plan), quantity: 1 }],
      subscription_data: { metadata: { userId, plan } },
      allow_promotion_codes: true,
      success_url: `${appUrl()}/settings?tab=billing&checkout=success`,
      cancel_url: `${appUrl()}/settings?tab=billing&checkout=cancel`,
    });

    if (!session.url) throw new ApiError(500, "Stripe did not return a session URL.");

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}

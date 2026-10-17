import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripeClient";
import { markSubscriptionCanceled, upsertSubscriptionFromStripe } from "@/lib/services/billingService";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Source of truth for the subscription status (billing Phase 1 docs). Do NOT use
// requireUserId() here: Stripe does not send our session cookie, the authenticity of the request
// comes only from signature verification (constructEvent) — never from the payload content
// alone, which a third party could forge.
function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set in the environment.");
  return secret;
}

function planFromMetadata(metadata: Stripe.Metadata): "starter" | "pro" | null {
  return metadata.plan === "starter" || metadata.plan === "pro" ? metadata.plan : null;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch (err) {
    // warn, not error: an invalid signature commonly comes from scanners/bots hitting the webhook
    // URL at random, not only from a real configuration incident — don't flood Sentry with this
    // noise (logger.error would trigger an exception capture).
    logger.warn("Invalid Stripe webhook signature", { err: String(err) });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription || !session.customer) break;

        const userId = session.client_reference_id;
        if (!userId) {
          logger.error("checkout.session.completed without client_reference_id", undefined, { sessionId: session.id });
          break;
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const plan = planFromMetadata(stripeSubscription.metadata);
        if (!plan) {
          logger.error("Stripe subscription without valid metadata.plan", undefined, {
            stripeSubscriptionId: stripeSubscription.id,
          });
          break;
        }

        await upsertSubscriptionFromStripe({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscription,
          plan,
        });
        break;
      }

      case "customer.subscription.updated": {
        const stripeSubscription = event.data.object;
        const userId = stripeSubscription.metadata.userId;
        const plan = planFromMetadata(stripeSubscription.metadata);
        if (!userId || !plan) {
          logger.error("customer.subscription.updated without userId/plan metadata", undefined, {
            stripeSubscriptionId: stripeSubscription.id,
          });
          break;
        }
        await upsertSubscriptionFromStripe({
          userId,
          stripeCustomerId: stripeSubscription.customer as string,
          stripeSubscription,
          plan,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSubscription = event.data.object;
        await markSubscriptionCanceled(stripeSubscription.id);
        break;
      }

      default:
        break;
    }
  } catch (error) {
    // Processing error (DB, Stripe call) rather than a deliberately ignored event (those
    // `break` above without throwing): we respond 5xx so that Stripe retries automatically
    // (retries with backoff for up to ~3 days) instead of silently accepting a lost event.
    logger.error("Error processing Stripe webhook", error, { eventType: event.type });
    return NextResponse.json({ error: "Internal processing error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripeClient";
import { markSubscriptionCanceled, upsertSubscriptionFromStripe } from "@/lib/services/billingService";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Source de vérité du statut d'abonnement (docs Phase 1 facturation). Ne PAS utiliser
// requireUserId() ici : Stripe n'envoie pas notre cookie de session, l'authenticité de la requête
// vient uniquement de la vérification de signature (constructEvent) — jamais du contenu du payload
// seul, qu'un tiers pourrait forger.
function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET n'est pas défini dans l'environnement.");
  return secret;
}

function planFromMetadata(metadata: Stripe.Metadata): "starter" | "pro" | null {
  return metadata.plan === "starter" || metadata.plan === "pro" ? metadata.plan : null;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature Stripe manquante." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret());
  } catch (err) {
    // warn, pas error : une signature invalide arrive couramment via des scanners/bots qui
    // tapent l'URL du webhook au hasard, pas seulement via un vrai incident de config — ne pas
    // saturer Sentry avec ce bruit (logger.error déclencherait une capture d'exception).
    logger.warn("Signature webhook Stripe invalide", { err: String(err) });
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription || !session.customer) break;

        const userId = session.client_reference_id;
        if (!userId) {
          logger.error("checkout.session.completed sans client_reference_id", undefined, { sessionId: session.id });
          break;
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const plan = planFromMetadata(stripeSubscription.metadata);
        if (!plan) {
          logger.error("Abonnement Stripe sans metadata.plan valide", undefined, {
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
          logger.error("customer.subscription.updated sans metadata userId/plan", undefined, {
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
    // Erreur de traitement (DB, appel Stripe) plutôt qu'un event volontairement ignoré (ceux-ci
    // font `break` plus haut sans lever) : on répond 5xx pour que Stripe réessaie automatiquement
    // (retries avec backoff jusqu'à ~3 jours) au lieu d'accepter silencieusement un event perdu.
    logger.error("Erreur de traitement du webhook Stripe", error, { eventType: event.type });
    return NextResponse.json({ error: "Erreur de traitement interne." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

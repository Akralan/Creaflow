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
  if (!url) throw new Error("APP_URL n'est pas défini dans l'environnement.");
  return url;
}

// Crée une session Stripe Checkout (mode "subscription") et renvoie son URL de redirection — le
// front navigue vers session.url, pas d'intégration Stripe.js côté client en v1. La ligne
// `subscriptions` locale n'est jamais créée ici : elle n'existe qu'après le webhook
// checkout.session.completed (source de vérité = Stripe, cf. billingService.ts).
export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { plan } = schema.parse(await request.json());

    // Bloque dès qu'un abonnement Stripe existe et n'est pas définitivement clos (pas seulement
    // active/trialing) : sinon un nouveau Checkout crée un 2e customer Stripe (pas de `customer:`
    // réutilisé ici) et une 2e subscription, avec la 1re qui continue d'exister côté Stripe sans
    // que l'app ne la référence plus jamais (l'upsert écrase la ligne locale sur userId).
    const existing = await getSubscriptionForUser(userId);
    if (existing && NON_TERMINAL_SUBSCRIPTION_STATUSES.has(existing.status)) {
      throw new ApiError(
        409,
        "Un abonnement est déjà en cours pour ce compte. Utilise le portail de facturation pour régulariser ton moyen de paiement ou le résilier."
      );
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new ApiError(404, "Utilisateur introuvable.");

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

    if (!session.url) throw new ApiError(500, "Stripe n'a pas renvoyé d'URL de session.");

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return handleApiError(error);
  }
}

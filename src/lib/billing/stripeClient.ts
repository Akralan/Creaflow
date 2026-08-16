import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Client Stripe paresseux (lazy) : évite de jeter au chargement du module (donc au build / dans les
 * tests qui n'utilisent jamais Stripe) si STRIPE_SECRET_KEY n'est pas défini — seul l'appel réel
 * échoue, comme getSecret() dans src/lib/auth/session.ts.
 */
export function getStripeClient(): Stripe {
  if (cached) return cached;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY n'est pas défini dans l'environnement.");
  }
  cached = new Stripe(secretKey);
  return cached;
}

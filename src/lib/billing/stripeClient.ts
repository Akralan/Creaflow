import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Lazy Stripe client: avoids throwing at module load (hence at build time / in tests that never
 * use Stripe) if STRIPE_SECRET_KEY is not set — only the actual call fails, like getSecret() in
 * src/lib/auth/session.ts.
 */
export function getStripeClient(): Stripe {
  if (cached) return cached;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set in the environment.");
  }
  cached = new Stripe(secretKey);
  return cached;
}

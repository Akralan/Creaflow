import { handleOAuthStart } from "@/lib/oauth/handlers";

/** Enveloppe conservée : cette URL est celle déposée sur github.com, elle ne peut pas bouger.
 *  Toute la logique est commune (src/lib/oauth/handlers.ts). */
export async function GET(request: Request) {
  return handleOAuthStart("github", new URL(request.url).searchParams.get("returnTo"));
}

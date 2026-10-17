import { unstable_rethrow } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { isOnboardingComplete } from "@/lib/services/onboardingService";

/**
 * Where to send a signed-in visitor of the home page: the calendar if they have a profile,
 * onboarding otherwise. `null` for everyone else — including on error (unreachable database,
 * cookie from another version without AUTH_SECRET): the landing must always render,
 * it's the page that search engines and link previews read (docs/SPEC_SEO.md §1).
 */
export async function resolveSignedInDestination(): Promise<"/calendar" | "/onboarding" | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    return (await isOnboardingComplete(userId)) ? "/calendar" : "/onboarding";
  } catch (error) {
    // Let Next's internal errors through (e.g. the "this route reads cookies, don't
    // prerender it" signal emitted at build): only application errors fall back to the landing.
    unstable_rethrow(error);
    logger.warn("Home page: session check failed, serving landing", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

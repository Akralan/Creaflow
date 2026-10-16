import { unstable_rethrow } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { isOnboardingComplete } from "@/lib/services/onboardingService";

/**
 * Où envoyer un visiteur de la page d'accueil déjà connecté : le calendrier s'il a un profil,
 * l'onboarding sinon. `null` pour tout le monde d'autre — y compris en cas d'erreur (base
 * injoignable, cookie d'une autre version sans AUTH_SECRET) : la landing doit toujours s'afficher,
 * c'est la page que lisent les moteurs et les aperçus de liens (docs/SPEC_SEO.md §1).
 */
export async function resolveSignedInDestination(): Promise<"/calendar" | "/onboarding" | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    return (await isOnboardingComplete(userId)) ? "/calendar" : "/onboarding";
  } catch (error) {
    // Laisse passer les erreurs internes de Next (ex. le signal « cette route lit des cookies, ne
    // pas la prérendre » émis au build) : seules les erreurs applicatives retombent sur la landing.
    unstable_rethrow(error);
    logger.warn("Page d'accueil : vérification de session impossible, landing servie", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

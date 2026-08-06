import type { SocialProvider } from "./types";
import { tiktokProvider } from "./tiktok";
import { instagramProvider } from "./instagram";
import { linkedinProvider } from "./linkedin";
import { youtubeProvider } from "./youtube";
import { xProvider } from "./x";

export * from "./types";

export const socialProviders: Partial<Record<string, SocialProvider>> = {
  tiktok: tiktokProvider,
  instagram: instagramProvider,
  linkedin: linkedinProvider,
  youtube: youtubeProvider,
  x: xProvider,
};

/** true si ce provider expose une récupération automatique de métriques — distinct de
 *  hasOAuthProvider (connexion de compte possible ≠ capacité de fetch metrics). Utilisé par
 *  l'UI Performance pour ne solliciter/afficher que les plateformes réellement exploitables,
 *  et pour griser LinkedIn/X tant que leur accès API n'est pas débloqué côté externe
 *  (docs/SPEC_METRIQUES_AUTO.md §2.4/§2.5). */
export function hasMetricsFetch(platform: string): boolean {
  return socialProviders[platform]?.fetchPostMetrics !== undefined;
}

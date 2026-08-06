export interface PlatformDefinition {
  key: string;
  label: string;
  /** true si un SocialProvider (OAuth) existe pour cette plateforme dans src/lib/social. */
  hasOAuth: boolean;
}

/** Registre extensible des plateformes reconnues par l'app. Toutes les plateformes ne
 *  proposent pas de connexion OAuth : les autres sont "suivies" (calendrier + objectifs)
 *  sans mécanique de SocialConnection. */
export const KNOWN_PLATFORMS: PlatformDefinition[] = [
  { key: "tiktok", label: "TikTok", hasOAuth: true },
  { key: "instagram", label: "Instagram", hasOAuth: true },
  { key: "linkedin", label: "LinkedIn", hasOAuth: true },
  // Corrigé (docs/SPEC_METRIQUES_AUTO.md §8) : provider écrit dans src/lib/social/x.ts —
  // l'activation réelle reste bloquée tant qu'aucun compte de facturation X n'est ouvert (§2.5).
  { key: "x", label: "X (Twitter)", hasOAuth: true },
  // Corrigé (docs/SPEC_METRIQUES_AUTO.md §8) : ce classement sous-estimait largement YouTube
  // (Data API v3 gratuite, aucune notion de compte business) — provider dans src/lib/social/youtube.ts.
  { key: "youtube", label: "YouTube", hasOAuth: true },
  { key: "newsletter", label: "Newsletter", hasOAuth: false },
  { key: "blog", label: "Blog / site perso", hasOAuth: false },
  { key: "slack", label: "Slack", hasOAuth: false },
  { key: "other", label: "Autre", hasOAuth: false },
];

export function isKnownPlatform(value: string): boolean {
  return KNOWN_PLATFORMS.some((p) => p.key === value);
}

export function hasOAuthProvider(value: string): boolean {
  return KNOWN_PLATFORMS.some((p) => p.key === value && p.hasOAuth);
}

export function platformLabel(value: string): string {
  return KNOWN_PLATFORMS.find((p) => p.key === value)?.label ?? value;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  platformUserId: string;
  // undefined = expiration inconnue/non exploitable pour cette plateforme (ex. long-lived token
  // Instagram) — dans ce cas socialConnectionService.getValidSocialAccessToken ne peut pas faire
  // de refresh proactif et laisse l'appel API échouer explicitement le cas échéant.
  expiresAt?: Date;
}

export interface FetchedPost {
  externalUrl: string;
  captionText?: string;
  metadata?: Record<string, unknown>;
}

/** Métrique d'un post publié, telle que renvoyée par l'API d'une plateforme (§4/§5 de
 *  docs/SPEC_METRIQUES_AUTO.md). `platformPostId` est la clé de rattachement post↔script. */
export interface PlatformPostMetric {
  platformPostId: string;
  externalUrl: string;
  captionText?: string;
  publishedAt?: Date;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface SocialProvider {
  getAuthUrl(state: string): string;
  // `verifier` optionnel : uniquement utilisé par X (OAuth 2.0 PKCE, cf. src/lib/social/x.ts),
  // qui réutilise `state` lui-même comme code_verifier — le callback générique le repasse tel
  // quel, les autres providers l'ignorent simplement.
  exchangeCode(code: string, verifier?: string): Promise<OAuthTokens>;
  // Usage existant : peuple InspirationVideo à la connexion (analyse de style), capé à 3 posts.
  // Ne pas réutiliser pour les métriques — voir fetchPostMetrics ci-dessous.
  fetchRecentPosts(tokens: OAuthTokens): Promise<FetchedPost[]>;
  // Optionnelle : absente = pas de refresh possible pour cette plateforme (connexion redevient
  // "needs_reconnect" dès expiration plutôt que d'être renouvelée silencieusement).
  refreshToken?(refreshToken: string): Promise<OAuthTokens>;
  // Optionnelle : absente = plateforme connectée mais sans récupération automatique de métriques
  // (cf. hasMetricsFetch dans src/lib/social/index.ts) — LinkedIn/X tant que non débloqués.
  fetchPostMetrics?(tokens: OAuthTokens): Promise<PlatformPostMetric[]>;
}

export function getRedirectUri(platform: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/auth/${platform}/callback`;
}

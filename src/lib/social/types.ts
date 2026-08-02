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
  { key: "x", label: "X (Twitter)", hasOAuth: false },
  { key: "youtube", label: "YouTube", hasOAuth: false },
  { key: "newsletter", label: "Newsletter", hasOAuth: false },
  { key: "blog", label: "Blog / site perso", hasOAuth: false },
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
}

export interface FetchedPost {
  externalUrl: string;
  captionText?: string;
  metadata?: Record<string, unknown>;
}

export interface SocialProvider {
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  fetchRecentPosts(tokens: OAuthTokens): Promise<FetchedPost[]>;
}

export function getRedirectUri(platform: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/auth/${platform}/callback`;
}

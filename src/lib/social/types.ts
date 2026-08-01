export type SocialPlatform = "tiktok" | "instagram" | "linkedin";

export const SOCIAL_PLATFORMS: SocialPlatform[] = ["tiktok", "instagram", "linkedin"];

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as string[]).includes(value);
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

export function getRedirectUri(platform: SocialPlatform): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/auth/${platform}/callback`;
}

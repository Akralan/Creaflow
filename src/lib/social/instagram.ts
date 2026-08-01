import type { SocialProvider, OAuthTokens, FetchedPost } from "./types";
import { getRedirectUri } from "./types";

/**
 * Instagram API with Instagram Login (Meta Graph API).
 * Endpoints/scopes à revérifier contre la doc Meta for Developers au moment de
 * l'approbation de l'app — Meta fait régulièrement évoluer ces flux OAuth.
 */
export const instagramProvider: SocialProvider = {
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.INSTAGRAM_CLIENT_ID || "",
      redirect_uri: getRedirectUri("instagram"),
      response_type: "code",
      scope: "instagram_business_basic",
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_CLIENT_ID || "",
        client_secret: process.env.INSTAGRAM_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        redirect_uri: getRedirectUri("instagram"),
        code,
      }),
    });
    if (!response.ok) {
      throw new Error(`Échange du code Instagram échoué (${response.status})`);
    }
    const data = await response.json();
    return {
      accessToken: data.access_token,
      platformUserId: String(data.user_id),
    };
  },

  async fetchRecentPosts(tokens: OAuthTokens): Promise<FetchedPost[]> {
    const params = new URLSearchParams({
      fields: "id,caption,permalink",
      limit: "3",
      access_token: tokens.accessToken,
    });
    const response = await fetch(`https://graph.instagram.com/me/media?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Récupération des médias Instagram échouée (${response.status})`);
    }
    const data = await response.json();
    const media: Array<{ id: string; caption?: string; permalink: string }> = data.data || [];
    return media.map((item) => ({
      externalUrl: item.permalink,
      captionText: item.caption,
      metadata: { id: item.id },
    }));
  },
};

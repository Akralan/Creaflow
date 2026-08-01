import type { SocialProvider, OAuthTokens, FetchedPost } from "./types";
import { getRedirectUri } from "./types";

/**
 * TikTok Login Kit (v2) + Display API.
 * Endpoints ci-dessous à revérifier contre la doc TikTok for Developers au moment
 * de l'approbation de l'app — ces APIs évoluent et nécessitent une app approuvée.
 */
export const tiktokProvider: SocialProvider = {
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_ID || "",
      scope: "user.info.basic,video.list",
      response_type: "code",
      redirect_uri: getRedirectUri("tiktok"),
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_ID || "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: getRedirectUri("tiktok"),
      }),
    });
    if (!response.ok) {
      throw new Error(`Échange du code TikTok échoué (${response.status})`);
    }
    const data = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      platformUserId: data.open_id,
    };
  },

  async fetchRecentPosts(tokens: OAuthTokens): Promise<FetchedPost[]> {
    const response = await fetch(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,video_description,share_url",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ max_count: 3 }),
      }
    );
    if (!response.ok) {
      throw new Error(`Récupération des vidéos TikTok échouée (${response.status})`);
    }
    const data = await response.json();
    const videos: Array<{ id: string; video_description?: string; share_url: string }> =
      data.data?.videos || [];
    return videos.map((video) => ({
      externalUrl: video.share_url,
      captionText: video.video_description,
      metadata: { id: video.id },
    }));
  },
};

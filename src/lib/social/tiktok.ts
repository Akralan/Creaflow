import type { SocialProvider, OAuthTokens, FetchedPost, PlatformPostMetric } from "./types";
import { getRedirectUri } from "./types";

interface TikTokTokenResponse {
  access_token: string;
  refresh_token?: string;
  open_id: string;
  expires_in: number;
}

/** POST /v2/oauth/token/ — commun à exchangeCode (grant_type=authorization_code) et
 *  refreshToken (grant_type=refresh_token), mêmes credentials, même forme de réponse. */
async function postToken(body: Record<string, string>): Promise<TikTokTokenResponse> {
  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_ID || "",
      client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
      ...body,
    }),
  });
  if (!response.ok) {
    throw new Error(`Requête token TikTok échouée (${response.status})`);
  }
  return response.json();
}

function toOAuthTokens(data: TikTokTokenResponse): OAuthTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    platformUserId: data.open_id,
    // Tokens TikTok expirent sous 24h (docs/SPEC_METRIQUES_AUTO.md §2.1) — d'où le refresh
    // proactif dans socialConnectionService.getValidSocialAccessToken.
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

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
    const data = await postToken({
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri("tiktok"),
    });
    return toOAuthTokens(data);
  },

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const data = await postToken({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    return toOAuthTokens(data);
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

  /** Métriques par vidéo pour la re-pondération automatique (docs/SPEC_METRIQUES_AUTO.md §2.1).
   *  Distinct de fetchRecentPosts (usage style/inspiration, capé à 3, pas de champs métriques) —
   *  ne pas fusionner les deux pour ne pas gonfler le payload d'inspiration. Pagine sur `cursor`
   *  tant que `has_more` est vrai. */
  async fetchPostMetrics(tokens: OAuthTokens): Promise<PlatformPostMetric[]> {
    const results: PlatformPostMetric[] = [];
    let cursor: number | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        "https://open.tiktokapis.com/v2/video/list/?fields=id,video_description,share_url,create_time,view_count,like_count,comment_count,share_count",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }),
        }
      );
      if (!response.ok) {
        throw new Error(`Récupération des métriques TikTok échouée (${response.status})`);
      }
      const data = await response.json();
      const videos: Array<{
        id: string;
        video_description?: string;
        share_url: string;
        create_time?: number;
        view_count?: number;
        like_count?: number;
        comment_count?: number;
        share_count?: number;
      }> = data.data?.videos || [];

      results.push(
        ...videos.map((video) => ({
          platformPostId: video.id,
          externalUrl: video.share_url,
          captionText: video.video_description,
          publishedAt: video.create_time ? new Date(video.create_time * 1000) : undefined,
          views: video.view_count ?? 0,
          likes: video.like_count ?? 0,
          comments: video.comment_count ?? 0,
          shares: video.share_count ?? 0,
        }))
      );

      hasMore = Boolean(data.data?.has_more);
      cursor = data.data?.cursor;
    }

    return results;
  },
};

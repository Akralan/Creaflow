import type { SocialProvider, OAuthTokens, FetchedPost, PlatformPostMetric } from "./types";
import { getRedirectUri } from "./types";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

/**
 * YouTube Data API v3 (OAuth Google standard 3-legged, PAS le flow popup `postmessage` de
 * src/lib/googleDrive/client.ts — domaines fonctionnels distincts, implémentations
 * volontairement séparées pour ne pas coupler deux usages qui n'ont pas vocation à évoluer
 * ensemble). Réutilise NEXT_PUBLIC_GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET déjà présents dans
 * .env.example, mais nécessite d'enregistrer la redirect URI `/api/auth/youtube/callback` dans
 * le même projet Google Cloud Console que celui utilisé pour Drive.
 *
 * Pas de métrique "partages" native exposée par la Data API v3 — mappée à 0 (cf. fetchPostMetrics).
 */

function getCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  };
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface ChannelInfo {
  channelId: string;
  uploadsPlaylistId: string;
}

async function fetchChannelInfo(accessToken: string): Promise<ChannelInfo> {
  const response = await fetch(`${YOUTUBE_API}/channels?part=id,contentDetails&mine=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Lecture de la chaîne YouTube échouée (${response.status})`);
  }
  const data = await response.json();
  const item = data.items?.[0];
  if (!item?.id || !item?.contentDetails?.relatedPlaylists?.uploads) {
    throw new Error("Aucune chaîne YouTube trouvée pour ce compte Google.");
  }
  return { channelId: item.id, uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads };
}

interface PlaylistVideoRef {
  videoId: string;
  title?: string;
  description?: string;
  publishedAt?: string;
}

async function listUploadedVideos(accessToken: string, playlistId: string, maxResults: number): Promise<PlaylistVideoRef[]> {
  const results: PlaylistVideoRef[] = [];
  let pageToken: string | undefined;

  while (results.length < maxResults) {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: String(Math.min(50, maxResults - results.length)),
      ...(pageToken ? { pageToken } : {}),
    });
    const response = await fetch(`${YOUTUBE_API}/playlistItems?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Récupération des vidéos YouTube échouée (${response.status})`);
    }
    const data = await response.json();
    const items: Array<{
      snippet: { resourceId: { videoId: string }; title?: string; description?: string; publishedAt?: string };
    }> = data.items || [];
    results.push(
      ...items.map((it) => ({
        videoId: it.snippet.resourceId.videoId,
        title: it.snippet.title,
        description: it.snippet.description,
        publishedAt: it.snippet.publishedAt,
      }))
    );
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return results.slice(0, maxResults);
}

interface VideoStats {
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

async function fetchVideoStatistics(accessToken: string, videoIds: string[]): Promise<Map<string, VideoStats>> {
  const stats = new Map<string, VideoStats>();
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({ part: "statistics", id: batch.join(",") });
    const response = await fetch(`${YOUTUBE_API}/videos?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Récupération des statistiques YouTube échouée (${response.status})`);
    }
    const data = await response.json();
    const items: Array<{ id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }> =
      data.items || [];
    for (const item of items) {
      stats.set(item.id, {
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
      });
    }
  }
  return stats;
}

async function exchangeOrRefresh(body: Record<string, string>): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getCredentials();
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  if (!response.ok) {
    throw new Error(`Requête token YouTube échouée (${response.status})`);
  }
  const data: GoogleTokenResponse = await response.json();
  const { channelId } = await fetchChannelInfo(data.access_token);
  return {
    accessToken: data.access_token,
    // Google ne renvoie généralement pas de nouveau refresh_token au refresh (seulement au
    // premier consentement) — getValidSocialAccessToken garde l'ancien si absent ici.
    refreshToken: data.refresh_token,
    platformUserId: channelId,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export const youtubeProvider: SocialProvider = {
  getAuthUrl(state: string): string {
    const { clientId } = getCredentials();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: getRedirectUri("youtube"),
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
      // access_type=offline + prompt=consent : garantit un refresh_token même si l'utilisateur a
      // déjà autorisé l'app par le passé (sinon Google ne le renvoie qu'au tout premier consentement).
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${AUTH_ENDPOINT}?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<OAuthTokens> {
    return exchangeOrRefresh({ code, redirect_uri: getRedirectUri("youtube"), grant_type: "authorization_code" });
  },

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    return exchangeOrRefresh({ refresh_token: refreshToken, grant_type: "refresh_token" });
  },

  async fetchRecentPosts(tokens: OAuthTokens): Promise<FetchedPost[]> {
    const { uploadsPlaylistId } = await fetchChannelInfo(tokens.accessToken);
    const videos = await listUploadedVideos(tokens.accessToken, uploadsPlaylistId, 3);
    return videos.map((v) => ({
      externalUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
      captionText: v.description,
      metadata: { id: v.videoId, title: v.title },
    }));
  },

  /** Métriques par vidéo pour la re-pondération automatique (docs/SPEC_METRIQUES_AUTO.md §2.2).
   *  `shares` mappé à 0 : la Data API v3 n'expose aucune métrique de partage native. */
  async fetchPostMetrics(tokens: OAuthTokens): Promise<PlatformPostMetric[]> {
    const { uploadsPlaylistId } = await fetchChannelInfo(tokens.accessToken);
    const videos = await listUploadedVideos(tokens.accessToken, uploadsPlaylistId, 20);
    if (videos.length === 0) return [];

    const stats = await fetchVideoStatistics(tokens.accessToken, videos.map((v) => v.videoId));

    return videos.map((v) => {
      const s = stats.get(v.videoId);
      return {
        platformPostId: v.videoId,
        externalUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        captionText: v.description,
        publishedAt: v.publishedAt ? new Date(v.publishedAt) : undefined,
        views: s?.viewCount ?? 0,
        likes: s?.likeCount ?? 0,
        comments: s?.commentCount ?? 0,
        shares: 0,
      };
    });
  },
};

import type { SocialProvider, OAuthTokens, FetchedPost, PlatformPostMetric } from "./types";
import { getRedirectUri } from "./types";

/**
 * Instagram API with Instagram Login (Meta Graph API).
 * Endpoints/scopes à revérifier contre la doc Meta for Developers au moment de
 * l'approbation de l'app — Meta fait régulièrement évoluer ces flux OAuth.
 *
 * Friction connue (docs/SPEC_METRIQUES_AUTO.md §2.3) : un compte Instagram personnel n'a AUCUN
 * accès API, quel que soit le chemin — seul un compte Creator (gratuit, réversible, ~3 taps dans
 * les réglages) fonctionne. Aucun contournement possible côté code, message porté par
 * ConnectionRow.tsx avant même la tentative de connexion.
 *
 * Spécificité refresh : Instagram n'a pas de refresh_token OAuth classique — le token d'accès
 * longue durée (60 jours) SE renouvelle lui-même via GET /refresh_access_token. Pour rester
 * compatible avec le contrat générique SocialProvider.refreshToken(refreshToken), le token
 * longue durée courant est dupliqué dans le champ `refreshToken` d'OAuthTokens à chaque échange
 * (refreshToken === accessToken) : socialConnectionService.getValidSocialAccessToken passera
 * donc bien ce token en paramètre à refreshToken() ci-dessous le moment venu.
 */

async function exchangeForLongLivedToken(shortLivedToken: string, platformUserId: string): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.INSTAGRAM_CLIENT_SECRET || "",
    access_token: shortLivedToken,
  });
  const response = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Échange vers un token Instagram longue durée échoué (${response.status})`);
  }
  const data: { access_token: string; expires_in: number } = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.access_token,
    platformUserId,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** Reels/vidéos : plays/likes/comments/shares via insights. Feed (image/carousel) : pas de
 *  "vues" au sens vidéo — likes/commentaires lus directement sur le nœud média par l'appelant,
 *  cette fonction n'est appelée que pour les types vidéo. Dégrade gracieusement à 0 si les
 *  insights sont indisponibles (scope limité, etc.) plutôt que de faire échouer tout le fetch. */
async function fetchVideoInsights(
  accessToken: string,
  mediaId: string
): Promise<{ views: number; likes: number; comments: number; shares: number }> {
  const params = new URLSearchParams({ metric: "plays,likes,comments,shares", access_token: accessToken });
  const response = await fetch(`https://graph.instagram.com/${mediaId}/insights?${params.toString()}`);
  if (!response.ok) {
    return { views: 0, likes: 0, comments: 0, shares: 0 };
  }
  const data = await response.json();
  const values: Record<string, number> = {};
  for (const entry of (data.data || []) as Array<{ name: string; values?: Array<{ value: number }> }>) {
    values[entry.name] = entry.values?.[0]?.value ?? 0;
  }
  return { views: values.plays ?? 0, likes: values.likes ?? 0, comments: values.comments ?? 0, shares: values.shares ?? 0 };
}

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
    // Le token retourné par cet échange initial est un short-lived token (1h) — on l'échange
    // immédiatement contre un long-lived token (60 jours, renouvelable), seul exploitable pour
    // un usage différé (fetch de métriques).
    return exchangeForLongLivedToken(data.access_token, String(data.user_id));
  },

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    // `refreshToken` est en réalité le token longue durée courant, cf. commentaire de tête de fichier.
    const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: refreshToken });
    const response = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Rafraîchissement du token Instagram échoué (${response.status})`);
    }
    const data: { access_token: string; expires_in: number } = await response.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.access_token,
      // Non renvoyé par cet endpoint et non utilisé par socialConnectionService.getValidSocialAccessToken
      // au refresh (seuls accessToken/refreshToken/expiresAt sont persistés) — valeur ignorée.
      platformUserId: "",
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
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

  /** Métriques par média pour la re-pondération automatique (docs/SPEC_METRIQUES_AUTO.md §2.3) —
   *  jeu de métriques différent selon Reels/vidéo (insights) et Feed image/carousel (champs
   *  directs du nœud média, pas de notion de "vues" pour un post statique). */
  async fetchPostMetrics(tokens: OAuthTokens): Promise<PlatformPostMetric[]> {
    const params = new URLSearchParams({
      fields: "id,caption,permalink,timestamp,media_type,like_count,comments_count",
      limit: "20",
      access_token: tokens.accessToken,
    });
    const response = await fetch(`https://graph.instagram.com/me/media?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Récupération des médias Instagram échouée (${response.status})`);
    }
    const data = await response.json();
    const media: Array<{
      id: string;
      caption?: string;
      permalink: string;
      timestamp?: string;
      media_type?: string;
      like_count?: number;
      comments_count?: number;
    }> = data.data || [];

    const results: PlatformPostMetric[] = [];
    for (const item of media) {
      const isVideoLike = item.media_type === "VIDEO" || item.media_type === "REELS";
      const insights = isVideoLike ? await fetchVideoInsights(tokens.accessToken, item.id) : null;
      results.push({
        platformPostId: item.id,
        externalUrl: item.permalink,
        captionText: item.caption,
        publishedAt: item.timestamp ? new Date(item.timestamp) : undefined,
        views: insights?.views ?? 0,
        likes: insights?.likes ?? item.like_count ?? 0,
        comments: insights?.comments ?? item.comments_count ?? 0,
        shares: insights?.shares ?? 0,
      });
    }
    return results;
  },
};

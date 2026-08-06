import crypto from "crypto";
import type { SocialProvider, OAuthTokens, FetchedPost, PlatformPostMetric } from "./types";
import { getRedirectUri } from "./types";

const TOKEN_ENDPOINT = "https://api.twitter.com/2/oauth2/token";

/**
 * X (Twitter) API v2 — OAuth 2.0 avec PKCE, contrairement aux autres providers de ce dossier qui
 * n'en ont pas besoin. Le connect/callback générique (src/app/api/auth/[platform]/*) stocke déjà
 * `state` dans un cookie httpOnly propre à cette tentative de connexion et le repasse à
 * exchangeCode — on le réutilise directement comme code_verifier PKCE plutôt que d'ajouter un
 * second cookie : `state` est généré par crypto.randomBytes(32).toString("hex") (64 caractères
 * hexadécimaux), ce qui satisfait à la fois son rôle de nonce CSRF et les contraintes RFC 7636 du
 * code_verifier (43-128 caractères parmi [A-Za-z0-9-._~], dont l'hexadécimal est un sous-ensemble
 * strict).
 *
 * Bloqué côté produit (docs/SPEC_METRIQUES_AUTO.md §2.5) : plus de tier gratuit depuis février
 * 2026, pay-per-use ($0,005/lecture de post) — nécessite l'ouverture d'un compte de facturation X
 * avant toute activation réelle. La dédup 24h qui limite la fréquence d'appel de fetchPostMetrics
 * est gérée génériquement dans postMetricsFetchService.ts (MIN_REFETCH_INTERVAL_HOURS), pas ici.
 */

function getCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.X_CLIENT_ID || "",
    clientSecret: process.env.X_CLIENT_SECRET || "",
  };
}

function basicAuthHeader(): string {
  const { clientId, clientSecret } = getCredentials();
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function codeChallengeFromVerifier(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

async function fetchUserId(accessToken: string): Promise<string> {
  const response = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Lecture du profil X échouée (${response.status})`);
  }
  const data = await response.json();
  return data.data?.id ?? "";
}

interface XTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function toOAuthTokens(data: XTokenResponse, fallbackRefreshToken?: string): Promise<OAuthTokens> {
  const platformUserId = await fetchUserId(data.access_token);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? fallbackRefreshToken,
    platformUserId,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export const xProvider: SocialProvider = {
  getAuthUrl(state: string): string {
    const { clientId } = getCredentials();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: getRedirectUri("x"),
      scope: "tweet.read users.read offline.access",
      state,
      code_challenge: codeChallengeFromVerifier(state),
      code_challenge_method: "S256",
    });
    return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
  },

  async exchangeCode(code: string, verifier?: string): Promise<OAuthTokens> {
    if (!verifier) {
      // Ne devrait jamais arriver via le callback générique (qui repasse toujours `state`) —
      // garde-fou explicite plutôt qu'un appel PKCE silencieusement invalide côté X.
      throw new Error("Échange du code X impossible : code_verifier PKCE manquant.");
    }
    const { clientId } = getCredentials();
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuthHeader() },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        redirect_uri: getRedirectUri("x"),
        code_verifier: verifier,
      }),
    });
    if (!response.ok) {
      throw new Error(`Échange du code X échoué (${response.status})`);
    }
    return toOAuthTokens(await response.json());
  },

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    const { clientId } = getCredentials();
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuthHeader() },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        client_id: clientId,
      }),
    });
    if (!response.ok) {
      throw new Error(`Rafraîchissement du token X échoué (${response.status})`);
    }
    return toOAuthTokens(await response.json(), refreshToken);
  },

  async fetchRecentPosts(tokens: OAuthTokens): Promise<FetchedPost[]> {
    const params = new URLSearchParams({ max_results: "5", "tweet.fields": "text" });
    const response = await fetch(`https://api.twitter.com/2/users/${tokens.platformUserId}/tweets?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Récupération des posts X échouée (${response.status})`);
    }
    const data = await response.json();
    const tweets: Array<{ id: string; text?: string }> = data.data || [];
    return tweets.slice(0, 3).map((t) => ({
      externalUrl: `https://x.com/i/web/status/${t.id}`,
      captionText: t.text,
      metadata: { id: t.id },
    }));
  },

  /** $0,005/lecture de post (docs/SPEC_METRIQUES_AUTO.md §2.5) — la dédup 24h qui limite la
   *  fréquence d'appel de cette fonction vit dans postMetricsFetchService.ts, pas ici. */
  async fetchPostMetrics(tokens: OAuthTokens): Promise<PlatformPostMetric[]> {
    const params = new URLSearchParams({ max_results: "20", "tweet.fields": "text,created_at,public_metrics" });
    const response = await fetch(`https://api.twitter.com/2/users/${tokens.platformUserId}/tweets?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Récupération des métriques X échouée (${response.status})`);
    }
    const data = await response.json();
    const tweets: Array<{
      id: string;
      text?: string;
      created_at?: string;
      public_metrics?: { impression_count?: number; like_count?: number; reply_count?: number; retweet_count?: number };
    }> = data.data || [];

    return tweets.map((t) => ({
      platformPostId: t.id,
      externalUrl: `https://x.com/i/web/status/${t.id}`,
      captionText: t.text,
      publishedAt: t.created_at ? new Date(t.created_at) : undefined,
      views: t.public_metrics?.impression_count ?? 0,
      likes: t.public_metrics?.like_count ?? 0,
      comments: t.public_metrics?.reply_count ?? 0,
      shares: t.public_metrics?.retweet_count ?? 0,
    }));
  },
};

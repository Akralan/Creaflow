import type { SocialProvider, OAuthTokens, FetchedPost, PlatformPostMetric } from "./types";
import { getRedirectUri } from "./types";

/**
 * LinkedIn OAuth 2.0 (3-legged).
 *
 * ATTENTION — limite réelle à connaître : contrairement à TikTok/Instagram, lister les
 * posts d'un profil personnel via l'API LinkedIn nécessite le produit "Community
 * Management API", qui est soumis à validation manuelle par LinkedIn et n'est PAS
 * accordé par défaut même à une app développeur approuvée. Sans cet accès, l'étape
 * "récupération des posts" ci-dessous échouera (403) même avec des identifiants
 * corrects. À vérifier/négocier avec LinkedIn avant de compter dessus pour le POC.
 *
 * fetchPostMetrics (docs/SPEC_METRIQUES_AUTO.md §2.4) : même blocage, product
 * "memberCreatorPostAnalytics" (lancé juillet 2025, scope r_member_postAnalytics) — expose
 * impressions/réactions/commentaires/reposts pour le membre authentifié (profil personnel, pas
 * besoin de page entreprise), mais reste soumis à la même validation Community Management API.
 * Code posé et fonctionnellement complet, non activable tant que CreaFlow n'a pas ce statut
 * développeur — hasMetricsFetch("linkedin") renverra tout de même true dès que ce fichier est
 * chargé, d'où l'usage de Promise.allSettled côté postMetricsFetchService/route refresh pour
 * qu'un échec LinkedIn n'affecte jamais les autres plateformes.
 */
export const linkedinProvider: SocialProvider = {
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      redirect_uri: getRedirectUri("linkedin"),
      scope: "openid profile r_member_social r_member_postAnalytics",
      state,
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  },

  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getRedirectUri("linkedin"),
        client_id: process.env.LINKEDIN_CLIENT_ID || "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
      }),
    });
    if (!response.ok) {
      throw new Error(`Échange du code LinkedIn échoué (${response.status})`);
    }
    const data = await response.json();

    const meResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const me = meResponse.ok ? await meResponse.json() : null;

    return {
      accessToken: data.access_token,
      platformUserId: me?.sub || "",
    };
  },

  async fetchRecentPosts(tokens: OAuthTokens): Promise<FetchedPost[]> {
    const response = await fetch(
      `https://api.linkedin.com/rest/posts?author=urn:li:person:${tokens.platformUserId}&q=author&count=3`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "LinkedIn-Version": "202401",
        },
      }
    );
    if (!response.ok) {
      throw new Error(
        `Récupération des posts LinkedIn échouée (${response.status}). Nécessite probablement l'accès "Community Management API" — voir commentaire en tête de fichier.`
      );
    }
    const data = await response.json();
    const elements: Array<{ id: string; commentary?: string }> = data.elements || [];
    return elements.map((post) => ({
      externalUrl: `https://www.linkedin.com/feed/update/${post.id}`,
      captionText: post.commentary,
      metadata: { id: post.id },
    }));
  },

  /** Métriques par post pour la re-pondération automatique — cf. commentaire en tête de fichier
   *  sur le blocage d'accès. Champs de la réponse à revérifier une fois l'accès obtenu, sur le
   *  modèle du disclaimer déjà en place pour fetchRecentPosts. */
  async fetchPostMetrics(tokens: OAuthTokens): Promise<PlatformPostMetric[]> {
    const params = new URLSearchParams({
      q: "member",
      member: `urn:li:person:${tokens.platformUserId}`,
      count: "20",
    });
    const response = await fetch(`https://api.linkedin.com/rest/memberCreatorPostAnalytics?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "LinkedIn-Version": "202401",
      },
    });
    if (!response.ok) {
      throw new Error(
        `Récupération des métriques LinkedIn échouée (${response.status}). Nécessite l'accès "Community Management API" — voir commentaire en tête de fichier.`
      );
    }
    const data = await response.json();
    const elements: Array<{
      post?: string;
      postUrl?: string;
      impressionCount?: number;
      likeCount?: number;
      commentCount?: number;
      repostCount?: number;
      createdAt?: number;
    }> = data.elements || [];

    return elements
      .filter((e): e is typeof e & { post: string } => Boolean(e.post))
      .map((e) => ({
        platformPostId: e.post,
        externalUrl: e.postUrl ?? `https://www.linkedin.com/feed/update/${e.post}`,
        publishedAt: e.createdAt ? new Date(e.createdAt) : undefined,
        views: e.impressionCount ?? 0,
        likes: e.likeCount ?? 0,
        comments: e.commentCount ?? 0,
        shares: e.repostCount ?? 0,
      }));
  },
};

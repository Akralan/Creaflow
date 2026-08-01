import type { SocialProvider, OAuthTokens, FetchedPost } from "./types";
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
 */
export const linkedinProvider: SocialProvider = {
  getAuthUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      redirect_uri: getRedirectUri("linkedin"),
      scope: "openid profile r_member_social",
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
};

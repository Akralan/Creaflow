import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchViewer,
  isGithubConfigured,
  getOAuthCredentials,
} from "@/lib/github/client";
import type { OAuthIdentityProvider } from "./types";

/**
 * GitHub vu comme fournisseur d'identité. N'implémente rien : traduit `src/lib/github/client.ts`,
 * écrit avant ce chantier, vers le contrat commun. À comportement strictement constant — les URL
 * de callback GitHub sont déjà déposées et ne doivent pas bouger.
 *
 * Pas de `refreshTokens` : le token d'une OAuth App classique ne périme pas.
 */
export const githubIdentityProvider: OAuthIdentityProvider = {
  id: "github",
  displayName: "GitHub",

  isConfigured: isGithubConfigured,

  // Seul fournisseur à ne pas dériver son URL de callback de APP_URL : la sienne est une variable
  // d'environnement à part, déposée telle quelle sur github.com.
  buildAuthorizeUrl: (state) => {
    getOAuthCredentials(); // lève explicitement si l'environnement est incomplet
    return buildAuthorizeUrl(state);
  },

  async exchangeCode(code) {
    const { accessToken, scope } = await exchangeCode(code);
    const viewer = await fetchViewer(accessToken);
    return {
      tokens: { accessToken, scope },
      identity: {
        providerUserId: viewer.githubUserId,
        login: viewer.login,
        name: viewer.name,
        bio: viewer.bio,
        avatarUrl: viewer.avatarUrl,
        email: viewer.email,
      },
    };
  },
};

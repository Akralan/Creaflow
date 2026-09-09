import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchViewer,
  isLinearConfigured,
  refreshAccessToken,
  type LinearTokens,
} from "@/lib/linear/client";
import type { OAuthIdentityProvider, ProviderTokens } from "./types";

function toTokens(tokens: LinearTokens): ProviderTokens {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? undefined,
    expiresAt: tokens.expiresAt ?? undefined,
    scope: tokens.scope,
  };
}

export const linearIdentityProvider: OAuthIdentityProvider = {
  id: "linear",
  displayName: "Linear",

  isConfigured: isLinearConfigured,
  buildAuthorizeUrl,

  async exchangeCode(code) {
    const tokens = await exchangeCode(code);
    const viewer = await fetchViewer(tokens.accessToken);

    return {
      tokens: toTokens(tokens),
      identity: {
        providerUserId: viewer.id,
        login: viewer.displayName ?? viewer.name ?? "Linear",
        name: viewer.name,
        // Linear n'a pas de champ biographie.
        bio: null,
        avatarUrl: viewer.avatarUrl,
        // Un compte Linear est toujours créé depuis une adresse vérifiée par invitation ou SSO.
        email: viewer.email,
      },
    };
  },

  // Indispensable, pas décoratif : le token ne vaut que 24 h.
  async refreshTokens(refreshToken) {
    return toTokens(await refreshAccessToken(refreshToken));
  },
};

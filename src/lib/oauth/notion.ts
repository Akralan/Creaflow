import {
  buildAuthorizeUrl,
  exchangeCode,
  isNotionConfigured,
  refreshAccessToken,
  type NotionTokenResponse,
} from "@/lib/notion/client";
import type { OAuthIdentityProvider, ProviderTokens } from "./types";

/** Notion ne renvoie pas de `scope` : ce qu'une intégration peut lire est décidé par les pages que
 *  l'utilisateur lui partage, pas par une chaîne de scopes. On stocke une valeur descriptive pour
 *  que la colonne, NOT NULL, reste lisible en base. */
const SCOPE = "notion:shared-pages";

function toTokens(response: NotionTokenResponse): ProviderTokens {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken ?? undefined,
    expiresAt: response.expiresAt ?? undefined,
    scope: SCOPE,
  };
}

export const notionIdentityProvider: OAuthIdentityProvider = {
  id: "notion",
  displayName: "Notion",

  isConfigured: isNotionConfigured,
  buildAuthorizeUrl,

  async exchangeCode(code) {
    const response = await exchangeCode(code);

    // L'identité vient de l'échange lui-même, pas d'un appel supplémentaire : Notion renvoie le
    // propriétaire dans la réponse de token quand l'autorisation a été demandée avec owner=user.
    return {
      tokens: toTokens(response),
      identity: {
        // Repli sur le bot : une intégration autorisée sans propriétaire identifiable reste
        // rattachable, elle ne pourra simplement pas créer de compte (email null).
        providerUserId: response.ownerUserId ?? response.botId ?? response.workspaceId ?? "",
        login: response.ownerName ?? response.workspaceName ?? "Notion",
        name: response.ownerName,
        bio: null,
        avatarUrl: response.ownerAvatarUrl,
        email: response.ownerEmail,
        config: { workspaceId: response.workspaceId, workspaceName: response.workspaceName },
      },
    };
  },

  async refreshTokens(refreshToken) {
    return toTokens(await refreshAccessToken(refreshToken));
  },
};

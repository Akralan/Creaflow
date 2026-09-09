/**
 * Contrat d'un fournisseur d'identité tiers (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7).
 *
 * Même esprit que `SourceConnector` : tout ce qui est spécifique à un fournisseur vit dans son
 * module, et le cœur — routes OAuth, résolution de compte, écran de connexion — ne connaît que ce
 * contrat. Un fournisseur d'identité est presque toujours aussi un connecteur de matière, mais les
 * deux rôles restent séparés : GitHub authentifie ET alimente, Shopify demain authentifiera une
 * boutique dont on lira les collections.
 */

export interface OAuthIdentity {
  /** Identifiant stable chez le fournisseur. Sert de clé de reconnaissance à la reconnexion. */
  providerUserId: string;
  /** Identifiant lisible, stocké tel quel dans `oauthAccounts.login`. */
  login: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  /**
   * Non null SEULEMENT si le fournisseur le donne comme vérifié.
   *
   * Un email non vérifié vaut `null`, jamais la chaîne : c'est ce qui interdit à quelqu'un de
   * revendiquer l'adresse d'un compte existant en la déclarant chez un tiers complaisant. Piège
   * connu côté Shopify, dont la réponse porte toujours `email` mais pas toujours `email_verified`.
   */
  email: string | null;
  /** Écrit dans `oauthAccounts.config`, relu par ce fournisseur seul (workspace Notion…). */
  config?: Record<string, unknown>;
}

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  /** `undefined` = ce token ne périme pas (GitHub). Sinon, date d'expiration absolue. */
  expiresAt?: Date;
  scope: string;
}

export interface OAuthIdentityProvider {
  /** Segment d'URL et valeur de `oauthAccounts.provider` : "github", "notion", "linear". */
  id: string;
  /** Nom montré à l'utilisateur — « Continuer avec Notion ». */
  displayName: string;

  /** Variables d'environnement présentes. Faux = le bouton n'est pas affiché, comme pour Stripe :
   *  l'app tourne sans, la fonctionnalité est simplement absente. */
  isConfigured(): boolean;

  buildAuthorizeUrl(state: string): string;

  /** `state` est repassé tel quel : les fournisseurs à PKCE (Etsy demain) le réutilisent comme
   *  code_verifier, les autres l'ignorent — même convention que `SocialProvider.exchangeCode`. */
  exchangeCode(code: string, state: string): Promise<{ tokens: ProviderTokens; identity: OAuthIdentity }>;

  /** Absent = ce fournisseur ne périme pas. Présent, il est appelé paresseusement à l'usage par
   *  `getValidProviderAccessToken` — aucun cron n'existe dans ce repo. */
  refreshTokens?(refreshToken: string): Promise<ProviderTokens>;
}

/** URL de callback d'un fournisseur. GitHub fait exception et garde la sienne, déjà déposée côté
 *  GitHub avant ce chantier (`GITHUB_OAUTH_REDIRECT_URI`) — la changer casserait les comptes. */
export function getOAuthRedirectUri(providerId: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  return `${appUrl}/api/auth/oauth/${providerId}/callback`;
}

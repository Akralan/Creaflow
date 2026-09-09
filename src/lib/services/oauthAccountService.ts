import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthAccounts, users } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { getIdentityProvider, identityProviderLabel } from "@/lib/oauth/registry";
import type { OAuthIdentity, ProviderTokens } from "@/lib/oauth/types";

/**
 * Comptes d'identité tiers, tous fournisseurs confondus (ex-githubAuthService).
 * Rien ici ne sait ce qu'est GitHub : le fournisseur est résolu depuis son identifiant.
 */

export type AccountResolution =
  | { action: "login"; userId: string }
  | { action: "link"; userId: string }
  | { action: "create" }
  | { action: "reject"; reason: string };

function unverifiedEmailMessage(providerId: string): string {
  const label = identityProviderLabel(providerId);
  return `${label} ne fournit pas d'adresse email vérifiée pour ce compte. Vérifie ton email sur ${label}, puis réessaie.`;
}

/**
 * Décision pure de résolution de compte. Extraite de l'accès base pour être testable sans
 * PostgreSQL — c'est la règle qui compte, pas les requêtes.
 *
 * L'ordre importe : une identité déjà liée prouve le compte, elle prime sur tout le reste. Le
 * rattachement par email n'est jamais fait sur une adresse non vérifiée — n'importe qui pourrait
 * sinon revendiquer l'adresse d'un compte existant et en prendre le contrôle.
 *
 * La règle ne dépend pas du fournisseur, et c'est délibéré : elle valait pour GitHub, elle vaut
 * telle quelle pour Notion, Linear, et demain Etsy et Shopify.
 */
export function decideAccountResolution(input: {
  identityUserId: string | null;
  hasVerifiedEmail: boolean;
  userIdWithSameEmail: string | null;
  providerId?: string;
}): AccountResolution {
  if (input.identityUserId) {
    return { action: "login", userId: input.identityUserId };
  }
  if (!input.hasVerifiedEmail) {
    return { action: "reject", reason: unverifiedEmailMessage(input.providerId ?? "") };
  }
  if (input.userIdWithSameEmail) {
    return { action: "link", userId: input.userIdWithSameEmail };
  }
  return { action: "create" };
}

/**
 * Verticale posée à la création d'un compte, selon le fournisseur qui l'a créé
 * (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.2). Les trois valeurs mènent aujourd'hui au MÊME parcours
 * d'onboarding : elles existent pour que le nom ne mente pas, et pour pouvoir différencier plus
 * tard sans migration.
 */
const VERTICAL_BY_PROVIDER: Record<string, "dev" | "artisan" | "entrepreneur"> = {
  github: "dev",
  linear: "dev",
  notion: "entrepreneur",
  etsy: "artisan",
  shopify: "artisan",
};

export function verticalForProvider(providerId: string): "dev" | "artisan" | "entrepreneur" {
  return VERTICAL_BY_PROVIDER[providerId] ?? "dev";
}

/** Applique la décision ci-dessus et rafraîchit le profil stocké à chaque connexion. */
export async function resolveOAuthAccount(
  providerId: string,
  identity: OAuthIdentity,
  tokens: ProviderTokens
): Promise<{ userId: string; isNew: boolean }> {
  const existing = await db.query.oauthAccounts.findFirst({
    where: and(eq(oauthAccounts.provider, providerId), eq(oauthAccounts.providerUserId, identity.providerUserId)),
  });
  const email = identity.email?.toLowerCase() ?? null;
  const sameEmail = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;

  const decision = decideAccountResolution({
    identityUserId: existing?.userId ?? null,
    hasVerifiedEmail: Boolean(email),
    userIdWithSameEmail: sameEmail?.id ?? null,
    providerId,
  });

  const profile = {
    login: identity.login,
    name: identity.name,
    bio: identity.bio,
    avatarUrl: identity.avatarUrl,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? null,
    accessTokenExpiresAt: tokens.expiresAt ?? null,
    scope: tokens.scope,
    config: identity.config ?? {},
  };

  if (decision.action === "reject") {
    throw new ApiError(409, decision.reason);
  }

  if (decision.action === "login") {
    await db.update(oauthAccounts).set(profile).where(eq(oauthAccounts.id, existing!.id));
    return { userId: decision.userId, isNew: false };
  }

  if (decision.action === "link") {
    // vertical délibérément NON modifiée : un compte créateur qui se connecte avec Notion reste en
    // parcours créateur. Sa verticale a été posée à l'inscription et ne se recalcule jamais.
    await db
      .insert(oauthAccounts)
      .values({ userId: decision.userId, provider: providerId, providerUserId: identity.providerUserId, ...profile });
    return { userId: decision.userId, isNew: false };
  }

  const [user] = await db
    .insert(users)
    .values({ email: email!, passwordHash: null, vertical: verticalForProvider(providerId) })
    .returning({ id: users.id });
  await db
    .insert(oauthAccounts)
    .values({ userId: user.id, provider: providerId, providerUserId: identity.providerUserId, ...profile });
  return { userId: user.id, isNew: true };
}

/** Le compte tiers d'un utilisateur pour ce fournisseur, ou null. */
export async function getOAuthAccount(userId: string, providerId: string) {
  return db.query.oauthAccounts.findFirst({
    where: and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, providerId)),
  });
}

/** Les fournisseurs auxquels ce compte est relié — l'UI s'en sert pour savoir quel sélecteur
 *  proposer, la verticale ne suffisant pas ("dev" couvre GitHub comme Linear).
 *
 *  Le nom lisible est joint ici pour la même raison que `connectorLabel` sur les sources : un écran
 *  générique ne doit pas avoir de table de libellés en dur. */
export async function listConnectedProviders(userId: string): Promise<Array<{ id: string; displayName: string }>> {
  const rows = await db.query.oauthAccounts.findMany({
    where: eq(oauthAccounts.userId, userId),
    columns: { provider: true },
  });
  return rows.map((row) => ({ id: row.provider, displayName: identityProviderLabel(row.provider) }));
}

// Marge avant expiration déclenchant un rafraîchissement — même valeur que
// getValidSocialAccessToken (socialConnectionService.ts) et getValidAccessToken (googleDriveService).
const EXPIRY_MARGIN_MS = 60 * 1000;

/**
 * Un access token valide pour (userId, provider), rafraîchi silencieusement si besoin.
 *
 * Rafraîchissement PARESSEUX, à l'usage : aucun cron n'existe dans ce repo. Réplique explicite de
 * `getValidSocialAccessToken`, généralisée aux fournisseurs d'identité.
 *
 * `accessTokenExpiresAt` null veut dire « ne périme pas » (GitHub) : on rend le token tel quel et
 * on laisse l'appel API échouer explicitement le cas échéant, plutôt que de rafraîchir dans le vide.
 */
export async function getValidProviderAccessToken(userId: string, providerId: string): Promise<string> {
  const account = await getOAuthAccount(userId, providerId);
  const label = identityProviderLabel(providerId);
  if (!account) {
    throw new ApiError(400, `Aucun compte ${label} connecté.`);
  }

  if (!account.accessTokenExpiresAt || account.accessTokenExpiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now()) {
    return account.accessToken;
  }

  const provider = getIdentityProvider(providerId);
  if (!provider?.refreshTokens || !account.refreshToken) {
    throw new ApiError(409, `Connexion ${label} expirée — reconnecte ton compte pour continuer.`);
  }

  try {
    const refreshed = await provider.refreshTokens(account.refreshToken);
    await db
      .update(oauthAccounts)
      .set({
        accessToken: refreshed.accessToken,
        // Linear renvoie un nouveau refresh token à chaque échange ; d'autres non. Garder l'ancien
        // quand il n'y en a pas de nouveau, sinon la connexion mourrait au rafraîchissement suivant.
        refreshToken: refreshed.refreshToken ?? account.refreshToken,
        accessTokenExpiresAt: refreshed.expiresAt ?? null,
        scope: refreshed.scope,
      })
      .where(eq(oauthAccounts.id, account.id));
    return refreshed.accessToken;
  } catch {
    throw new ApiError(409, `Connexion ${label} expirée — reconnecte ton compte pour continuer.`);
  }
}

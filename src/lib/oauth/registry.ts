import { githubIdentityProvider } from "./github";
import { linearIdentityProvider } from "./linear";
import { notionIdentityProvider } from "./notion";
import type { OAuthIdentityProvider } from "./types";

/**
 * Fournisseur → implémentation. Seul endroit à toucher pour en brancher un nouveau
 * (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7).
 *
 * Volontairement un `Record<string, …>` et non un enum : `oauthAccounts.provider` est une colonne
 * `text` pour la même raison — ajouter Etsy ou Shopify ne doit pas coûter une migration.
 */
const providers: Record<string, OAuthIdentityProvider> = {
  github: githubIdentityProvider,
  notion: notionIdentityProvider,
  linear: linearIdentityProvider,
};

export function getIdentityProvider(id: string): OAuthIdentityProvider | null {
  return providers[id] ?? null;
}

/** Les fournisseurs dont l'environnement est complet, dans l'ordre d'affichage sur /login. Un
 *  fournisseur mal configuré n'y figure pas : mieux vaut pas de bouton qu'un bouton qui échoue. */
export function listConfiguredProviders(): Array<{ id: string; displayName: string }> {
  return Object.values(providers)
    .filter((provider) => provider.isConfigured())
    .map(({ id, displayName }) => ({ id, displayName }));
}

/** Nom lisible d'un fournisseur, y compris inconnu — utilisé dans les messages d'erreur, qui ne
 *  doivent jamais afficher un identifiant technique à l'utilisateur. */
export function identityProviderLabel(id: string): string {
  return providers[id]?.displayName ?? id;
}

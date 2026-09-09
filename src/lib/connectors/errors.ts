/**
 * Quota du fournisseur atteint. Ce n'est pas une panne : les routes la traduisent en 429 avec un
 * message daté plutôt qu'en 500 « Erreur serveur ».
 *
 * Classe de base partagée pour que les routes n'aient pas à connaître le fournisseur — c'est
 * `GithubRateLimitError` qui en hérite, pas l'inverse.
 */
export class ConnectorRateLimitError extends Error {
  retryAfterMinutes: number;
  constructor(message: string, retryAfterMinutes: number) {
    super(message);
    this.name = "ConnectorRateLimitError";
    this.retryAfterMinutes = retryAfterMinutes;
  }
}

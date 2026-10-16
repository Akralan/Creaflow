/**
 * Traduit une erreur du fournisseur LLM en phrase pour l'écran. L'erreur brute reste dans les logs :
 * la personne a besoin de savoir si ça vaut la peine de réessayer, pas du code HTTP.
 */
export function llmFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/credit|quota|billing|insufficient/i.test(raw)) {
    return "Le service d'IA a refusé la demande : le compte OpenAI n'a plus de crédits.";
  }
  if (/\b401\b|api key|unauthori[sz]ed|incorrect.*key/i.test(raw)) {
    return "Le service d'IA n'est pas configuré : la clé OpenAI est absente ou invalide.";
  }
  if (/\b429\b|rate limit/i.test(raw)) {
    return "Le service d'IA est saturé pour le moment.";
  }
  return "Le service d'IA n'a pas répondu.";
}

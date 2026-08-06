export function buildCaptionSystemPrompt(productNames: string[]): string {
  const productLine =
    productNames.length > 0
      ? `Produits du catalogue de l'utilisateur (pour le rattachement éventuel) : ${productNames.join(", ")}.`
      : "Aucun produit connu dans le catalogue de l'utilisateur.";

  return `Tu indexes une photo de marque pour une bibliothèque de ressources visuelles utilisée par un artisan/créateur pour produire ses posts. Décris la photo de façon factuelle et utile pour la retrouver plus tard par recherche sémantique. ${productLine}`;
}

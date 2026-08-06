export interface AssetSearchContext {
  categoryLabel: string;
  categoryDescription: string;
  productName?: string | null;
  seriesLabel?: string | null;
}

/** Construit la requête textuelle éditoriale servant de base à l'embedding de recherche —
 *  pure, testable sans DB. Les requêtes sont éditoriales, pas visuelles (catégorie/produit/série),
 *  cf. docs/SPEC_RESSOURCES_VISUELLES.md §5.2. */
export function buildAssetSearchQuery(context: AssetSearchContext): string {
  const parts = [`Catégorie de contenu : ${context.categoryLabel} — ${context.categoryDescription}.`];
  if (context.productName) parts.push(`Produit : ${context.productName}.`);
  if (context.seriesLabel) parts.push(`Série : ${context.seriesLabel}.`);
  return parts.join(" ");
}

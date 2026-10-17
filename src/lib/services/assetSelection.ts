export interface AssetSearchContext {
  categoryLabel: string;
  categoryDescription: string;
  productName?: string | null;
  seriesLabel?: string | null;
}

/** Builds the editorial text query used as the basis for the search embedding —
 *  pure, testable without a DB. Queries are editorial, not visual (category/topic/series),
 *  cf. docs/SPEC_RESSOURCES_VISUELLES.md §5.2. */
export function buildAssetSearchQuery(context: AssetSearchContext): string {
  const parts = [`Content category: ${context.categoryLabel} — ${context.categoryDescription}.`];
  if (context.productName) parts.push(`Topic: ${context.productName}.`);
  if (context.seriesLabel) parts.push(`Series: ${context.seriesLabel}.`);
  return parts.join(" ");
}

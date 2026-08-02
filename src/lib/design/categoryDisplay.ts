import { categoryPalette } from "@/lib/design/tokens";

function hashToIndex(id: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % mod;
}

export function resolveCategoryMeta(category?: { id: string; label: string } | null) {
  if (!category) {
    return { label: "—", ...categoryPalette[0] };
  }
  return { label: category.label, ...categoryPalette[hashToIndex(category.id, categoryPalette.length)] };
}

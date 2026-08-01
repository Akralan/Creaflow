import { categoryMeta, type ContentCategory } from "@/lib/design/tokens";
import type { CategoryLabels } from "@/lib/apiClient";

export function resolveCategoryMeta(category: ContentCategory, custom?: CategoryLabels | null) {
  const base = categoryMeta[category];
  return { ...base, label: custom?.[category]?.label || base.label };
}

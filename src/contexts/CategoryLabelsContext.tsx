"use client";

import { createContext, useContext } from "react";
import type { CategoryLabels } from "@/lib/apiClient";

export const CategoryLabelsContext = createContext<CategoryLabels | null>(null);

export function useCategoryLabels(): CategoryLabels | null {
  return useContext(CategoryLabelsContext);
}

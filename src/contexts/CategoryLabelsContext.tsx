"use client";

import { createContext, useContext } from "react";
import type { ContentCategory } from "@/lib/apiClient";

export const CategoryLabelsContext = createContext<ContentCategory[]>([]);

export function useContentCategories(): ContentCategory[] {
  return useContext(CategoryLabelsContext);
}

"use client";

import { createContext, useContext } from "react";
import type { ContentSeries } from "@/lib/apiClient";

export const SeriesContext = createContext<ContentSeries[]>([]);

export function useContentSeries(): ContentSeries[] {
  return useContext(SeriesContext);
}

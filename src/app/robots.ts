import type { MetadataRoute } from "next";
import { getSiteUrl, isIndexable, PRIVATE_ROUTE_PREFIXES } from "@/lib/seo";

// Servi sur /robots.txt. Généré au build : la décision dépend de APP_URL / SEO_INDEXABLE telles
// qu'elles étaient au build (docs/SPEC_SEO.md §3).
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_ROUTE_PREFIXES] },
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}

import type { MetadataRoute } from "next";
import { getSiteUrl, isIndexable, PRIVATE_ROUTE_PREFIXES } from "@/lib/seo";

// Served at /robots.txt. Generated at build: the decision depends on APP_URL / SEO_INDEXABLE as
// they were at build time (docs/SPEC_SEO.md §3).
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_ROUTE_PREFIXES] },
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}

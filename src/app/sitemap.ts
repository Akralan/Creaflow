import type { MetadataRoute } from "next";
import { getSiteUrl, PUBLIC_ROUTES } from "@/lib/seo";

// Servi sur /sitemap.xml. Seules les pages publiques y figurent ; la landing en premier, les pages
// légales derrière. `lastModified` est la date du build : ces pages ne changent qu'avec un déploiement.
export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteUrl();
  const now = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: new URL(route, site).toString(),
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "yearly",
    priority: route === "/" ? 1 : 0.3,
  }));
}

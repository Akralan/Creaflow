import type { MetadataRoute } from "next";
import { getSiteUrl, PUBLIC_ROUTES } from "@/lib/seo";

// Served at /sitemap.xml. Only public pages appear; the landing first, the legal pages
// after. `lastModified` is the build date: these pages only change with a deployment.
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

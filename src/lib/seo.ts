import type { Metadata } from "next";

/**
 * Everything SEO needs to know, in one place (docs/SPEC_SEO.md): site identity,
 * public address, and the rule "is this deployment allowed to be indexed?".
 *
 * `APP_URL` is read here when the module loads: for pages prerendered at build (legal,
 * robots, sitemap, Open Graph image), the value present AT BUILD is what counts — hence its
 * passing as `build.args` in docker-compose.prod.yml, and not only in `env_file`.
 */

export const SITE_NAME = "Tellovo";
export const SITE_TITLE = "Tellovo — Just build. We grow your audience.";
export const SITE_DESCRIPTION =
  "Turn your GitHub activity into a weekly content plan for X and LinkedIn — built around your SaaS, your future customers, and your voice.";

const FALLBACK_SITE_URL = "http://localhost:3000";

/** Public pages, the only ones to put in the sitemap and allow indexing. */
export const PUBLIC_ROUTES = ["/", "/legal/cgu", "/legal/confidentialite", "/legal/mentions-legales"] as const;

/** Prefixes off-limits to robots: the signed-in app (rendered empty without a session), the API and the
 *  entry screens. `/login` is excluded too: a form page has no place in search results. */
export const PRIVATE_ROUTE_PREFIXES = [
  "/api/",
  "/calendar",
  "/scripts",
  "/direction",
  "/performance",
  "/settings",
  "/onboarding",
  "/login",
  "/start",
  "/connexion",
] as const;

/** Demo or test host suffixes: never indexed, otherwise the real domain would inherit a
 *  duplicate the day it arrives. */
const NON_INDEXABLE_HOST_SUFFIXES = [".vps.ovh.ca", ".vps.ovh.net", ".sslip.io", ".nip.io", ".localhost"];
const NON_INDEXABLE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type Env = Record<string, string | undefined>;

export function getSiteUrl(env: Env = process.env): URL {
  try {
    return new URL(env.APP_URL || FALLBACK_SITE_URL);
  } catch {
    return new URL(FALLBACK_SITE_URL);
  }
}

/**
 * `SEO_INDEXABLE=true|false` decides explicitly. Without it: indexable only if `APP_URL` is
 * an https address on a domain that is neither local nor a demo host. Doubt favors
 * "no" — a forgotten deployment must never end up in Google by accident.
 */
export function isIndexable(env: Env = process.env): boolean {
  const explicit = env.SEO_INDEXABLE?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  if (!env.APP_URL) return false;
  let url: URL;
  try {
    url = new URL(env.APP_URL);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (NON_INDEXABLE_HOSTS.has(host)) return false;
  return !NON_INDEXABLE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** To set on any segment that must never appear in a search engine. */
export const NO_INDEX: NonNullable<Metadata["robots"]> = { index: false, follow: false };

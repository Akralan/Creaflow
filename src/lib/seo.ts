import type { Metadata } from "next";

/**
 * Tout ce que le référencement a besoin de savoir, au même endroit (docs/SPEC_SEO.md) : identité du
 * site, adresse publique, et la règle « ce déploiement a-t-il le droit d'être indexé ? ».
 *
 * `APP_URL` est lue ici au chargement du module : pour les pages prérendues au build (légales,
 * robots, sitemap, image Open Graph), c'est la valeur présente AU BUILD qui compte — d'où son
 * passage en `build.args` dans docker-compose.prod.yml, et pas seulement dans `env_file`.
 */

export const SITE_NAME = "CreaFlow";
export const SITE_TITLE = "CreaFlow — Vos notes de travail deviennent vos posts";
export const SITE_DESCRIPTION =
  "Vos notes de travail deviennent vos posts de la semaine. Rédacteur en chef IA pour indépendants, fondateurs et développeurs qui documentent déjà ce qu'ils font.";

const FALLBACK_SITE_URL = "http://localhost:3000";

/** Pages publiques, les seules à mettre dans le sitemap et à laisser indexer. */
export const PUBLIC_ROUTES = ["/", "/legal/cgu", "/legal/confidentialite", "/legal/mentions-legales"] as const;

/** Préfixes interdits aux robots : l'app connectée (rendue vide sans session), l'API et les écrans
 *  d'entrée. `/login` est exclu aussi : une page de formulaire n'a rien à faire dans un résultat. */
export const PRIVATE_ROUTE_PREFIXES = [
  "/api/",
  "/calendar",
  "/scripts",
  "/direction",
  "/performance",
  "/assistant",
  "/settings",
  "/onboarding",
  "/login",
  "/reinitialiser-mot-de-passe",
] as const;

/** Suffixes d'hôtes de démo ou de test : jamais indexés, sinon le vrai domaine hériterait d'un
 *  doublon le jour où il arrive. */
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
 * `SEO_INDEXABLE=true|false` tranche explicitement. Sans elle : indexable seulement si `APP_URL` est
 * une adresse https sur un domaine qui n'est ni local ni un hôte de démo. Le doute profite au
 * « non » — un déploiement oublié ne doit jamais se retrouver dans Google par accident.
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

/** À poser sur tout segment qui ne doit jamais apparaître dans un moteur. */
export const NO_INDEX: NonNullable<Metadata["robots"]> = { index: false, follow: false };

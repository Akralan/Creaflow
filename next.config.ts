import type { NextConfig } from "next";

// CSP volontairement sans nonce (cf. guide Next.js "Without Nonces") : l'app utilise `style={{}}`
// (styles inline React) partout plutôt que des classes CSS générées — passer en CSP à base de
// nonce casserait tout l'attribut `style` sans une réécriture complète en CSS-in-JS/nonce-aware.
// Un nonce imposerait aussi le rendu dynamique partout (perte de la génération statique/ISR),
// ce que ce repo n'a pas choisi d'assumer.
//
// `'unsafe-inline'` est donc nécessaire sur script-src ET style-src — pas seulement style-src
// comme dans une première version de ce fichier. Next.js injecte lui-même des <script> inline
// pour l'hydratation RSC (self.__next_f, self.__next_r), en dev ET en prod : sans 'unsafe-inline'
// sur script-src, le navigateur les bloque et l'hydratation casse silencieusement (constaté en
// conditions réelles : `InvariantError: Expected a request ID... self.__next_r`, cf. docs/TECH.md).
// Conséquence assumée : la CSP ne bloque plus l'exécution d'un script injecté (XSS) — elle garde
// sa valeur sur les autres axes (object-src, frame-ancestors, base-uri, connect-src/img-src
// restreints aux domaines nécessaires). C'est le compromis documenté par Next.js lui-même pour
// qui n'utilise pas de nonce, pas une régression spécifique à ce repo.
// 'unsafe-eval' en dev uniquement : React s'en sert pour reconstruire les stacks d'erreur serveur
// dans le navigateur (doc Next.js CSP) — jamais nécessaire en production.
// Domaines Google whitelistés pour le Picker (src/components/BrandAssetLibrary/GooglePickerButton.tsx)
// — fonctionnalité "implémentée, non encore vérifiée en environnement réel" (docs/SPEC_RESSOURCES_VISUELLES.md).
function originOf(url: string | undefined): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}

function buildCsp(): string {
  const r2Origin = originOf(process.env.R2_PUBLIC_BASE_URL);
  // Le host d'ingestion Sentry dépend de l'org/région du projet (ex. o123456.ingest.us.sentry.io,
  // .de.sentry.io, ou un domaine self-hosted) — extrait du DSN client réel plutôt que deviné, sinon
  // le SDK client (src/instrumentation-client.ts) est initialisé pour rien : le navigateur bloque
  // ses requêtes sortantes sans cette entrée dans connect-src, en échouant silencieusement (pas
  // d'erreur applicative, juste une ligne dans la console DevTools).
  const sentryOrigin = originOf(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const isDev = process.env.NODE_ENV === "development";

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' https://apis.google.com https://accounts.google.com${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:${r2Origin ? ` ${r2Origin}` : ""}`,
    `font-src 'self' data:`,
    `connect-src 'self' https://apis.google.com https://www.googleapis.com https://oauth2.googleapis.com https://accounts.google.com${sentryOrigin ? ` ${sentryOrigin}` : ""}`,
    `frame-src https://accounts.google.com https://docs.google.com https://drive.google.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];
  return directives.join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: buildCsp() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // includeSubDomains sans preload : preload engage sur une liste quasi irréversible côté
  // navigateurs, pas un choix à figer avant d'avoir un domaine de prod stable.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

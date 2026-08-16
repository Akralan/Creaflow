import type { NextConfig } from "next";

// CSP volontairement sans nonce (cf. guide Next.js "Without Nonces") : l'app utilise `style={{}}`
// (styles inline React) partout plutôt que des classes CSS générées — passer en CSP à base de
// nonce casserait tout l'attribut `style` sans une réécriture complète en CSS-in-JS/nonce-aware.
// `'unsafe-inline'` reste donc nécessaire sur style-src ; script-src, lui, reste strict.
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

  const directives = [
    `default-src 'self'`,
    `script-src 'self' https://apis.google.com https://accounts.google.com`,
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

import * as Sentry from "@sentry/nextjs";

// Runtime Edge (ex. si une route bascule un jour sur `export const runtime = "edge"`) — aucune
// route de ce repo n'utilise l'Edge runtime aujourd'hui (les routes billing forcent explicitement
// "nodejs"), mais Next.js exige ce fichier dès que instrumentation.ts référence NEXT_RUNTIME="edge".
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

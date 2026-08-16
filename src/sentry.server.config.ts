import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // 100% en dev (peu de volume, utile pour vérifier l'intégration) ; 10% en prod pour limiter le
  // coût — pas d'objectif de tracing fin en v1, seule la capture d'erreurs est prioritaire.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

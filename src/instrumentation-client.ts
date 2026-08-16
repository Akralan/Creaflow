import * as Sentry from "@sentry/nextjs";

// Pas de Session Replay (Sentry.replayIntegration()) volontairement : ça enregistre l'écran de
// l'utilisateur, ce que la politique de confidentialité actuelle (src/app/legal/confidentialite)
// ne couvre pas — l'activer nécessiterait de mettre à jour cette page et potentiellement le
// bandeau de consentement cookies avant activation, pas juste une ligne de config ici.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

import * as Sentry from "@sentry/nextjs";

// No Session Replay (Sentry.replayIntegration()) on purpose: it records the user's
// screen, which the current privacy policy (src/app/legal/confidentialite)
// does not cover — enabling it would require updating that page and potentially the
// cookie consent banner before activation, not just a config line here.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // 100% in dev (low volume, useful to check the integration); 10% in prod to limit the
  // cost — no fine tracing goal in v1, only error capture is a priority.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

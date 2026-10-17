import * as Sentry from "@sentry/nextjs";

// Edge runtime (e.g. if a route one day switches to `export const runtime = "edge"`) — no
// route in this repo uses the Edge runtime today (the billing routes explicitly force
// "nodejs"), but Next.js requires this file as soon as instrumentation.ts references NEXT_RUNTIME="edge".
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

import * as Sentry from "@sentry/nextjs";

// register() is called only once at server startup — loads the Sentry config specific
// to each runtime (Node vs Edge). Without SENTRY_DSN defined, Sentry.init() below runs
// with dsn: undefined, which silently disables event sending (documented
// SDK behaviour) — no conditional branch needed here.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Automatically captures unhandled server errors (Server Components, Route Handlers,
// Server Actions) that handleApiError (src/lib/api/errors.ts) does not see — it only covers
// the API routes that call it explicitly in their catch.
export const onRequestError = Sentry.captureRequestError;

/**
 * Structured logger (JSON, one line per entry) — replaces the ad hoc `console.error`/`console.log`
 * scattered through the code. `logger.error` also forwards the exception to Sentry if
 * `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` is configured (silent no-op otherwise, see
 * instrumentation.ts and instrumentation-client.ts).
 *
 * The `context` passed to each call is serialized as-is into the log and the Sentry tags —
 * each call site is responsible for never putting a secret in it (password, OAuth token,
 * API key). The logger filters nothing itself.
 */

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

type SerializedError = { message: string; stack?: string; cause?: SerializedError };

// drizzle-orm (and many other libs) wrap the original error in `.cause` — without
// following it, a query failure only ever shows "Failed query: ..." and never the real Postgres
// error (missing relation, violated constraint, lost connection...) that it wraps.
function serializeError(error: unknown): SerializedError | undefined {
  if (error === undefined) return undefined;
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      cause: error.cause !== undefined ? serializeError(error.cause) : undefined,
    };
  }
  return { message: String(error) };
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const entry = { level, message, timestamp: new Date().toISOString(), ...context };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// Dynamic import: avoids pulling the Sentry SDK (and its initialization) into Vitest tests
// or any caller that does not care, and a possible error in the SDK itself must
// never crash the caller — monitoring must never become a point of failure.
async function reportToSentry(message: string, error: unknown, context?: LogContext): Promise<void> {
  try {
    const Sentry = await import("@sentry/nextjs");
    // With a real JS exception: captureException (keeps the stack). Without one (e.g. a data
    // anomaly detected without a throw — malformed webhook, missing metadata): captureMessage anyway,
    // otherwise these cases would never reach Sentry even though they deserve an alert.
    if (error !== undefined) {
      Sentry.captureException(error, { extra: { message, ...context } });
    } else {
      Sentry.captureMessage(message, { level: "error", extra: context });
    }
  } catch {
    // Sentry not configured/not available in this execution context — deliberately ignored.
  }
}

export const logger = {
  // Explicit opt-in (=== "development"), not opt-out (!== "production"): the latter would let
  // debug noise through under NODE_ENV=test too (Vitest sets it to "test", not "production"),
  // polluting the output of `npm run test`. Same idiom as sentry.server.config.ts and the like.
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "development") emit("debug", message, context);
  },
  info(message: string, context?: LogContext): void {
    emit("info", message, context);
  },
  warn(message: string, context?: LogContext): void {
    emit("warn", message, context);
  },
  /** `error` is optional: some calls log an anomaly without an associated JS exception. */
  error(message: string, error?: unknown, context?: LogContext): void {
    emit("error", message, { ...context, error: serializeError(error) });
    void reportToSentry(message, error, context);
  },
};

/**
 * Logger structuré (JSON, une ligne par entrée) — remplace les `console.error`/`console.log`
 * ad hoc dispersés dans le code. `logger.error` fait aussi remonter l'exception à Sentry si
 * `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` est configuré (no-op silencieux sinon, cf.
 * instrumentation.ts et instrumentation-client.ts).
 *
 * Le `context` passé à chaque appel est sérialisé tel quel dans le log et dans les tags Sentry —
 * chaque site d'appel est responsable de ne jamais y mettre un secret (mot de passe, token OAuth,
 * clé API). Le logger ne filtre rien lui-même.
 */

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

type SerializedError = { message: string; stack?: string; cause?: SerializedError };

// drizzle-orm (et beaucoup d'autres libs) enveloppent l'erreur d'origine dans `.cause` — sans la
// suivre, un échec de requête ne montre jamais que "Failed query: ..." et jamais la vraie erreur
// Postgres (relation manquante, contrainte violée, connexion perdue...) qu'elle enveloppe.
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

// Import dynamique : évite de tirer le SDK Sentry (et son initialisation) dans les tests Vitest
// ou tout appelant qui ne s'en soucie pas, et une éventuelle erreur du SDK lui-même ne doit
// jamais faire planter l'appelant — le monitoring ne doit jamais devenir un point de panne.
async function reportToSentry(message: string, error: unknown, context?: LogContext): Promise<void> {
  try {
    const Sentry = await import("@sentry/nextjs");
    // Avec une vraie exception JS : captureException (garde la stack). Sans (ex. une anomalie de
    // données détectée sans throw — webhook malformé, metadata manquante) : captureMessage quand
    // même, sinon ces cas ne remonteraient jamais à Sentry alors qu'ils méritent une alerte.
    if (error !== undefined) {
      Sentry.captureException(error, { extra: { message, ...context } });
    } else {
      Sentry.captureMessage(message, { level: "error", extra: context });
    }
  } catch {
    // Sentry non configuré/non disponible dans ce contexte d'exécution — ignoré volontairement.
  }
}

export const logger = {
  // Opt-in explicite (=== "development"), pas opt-out (!== "production") : ce dernier laisserait
  // passer le bruit de debug sous NODE_ENV=test aussi (Vitest le fixe à "test", pas "production"),
  // polluant la sortie de `npm run test`. Même idiome que sentry.server.config.ts et consorts.
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "development") emit("debug", message, context);
  },
  info(message: string, context?: LogContext): void {
    emit("info", message, context);
  },
  warn(message: string, context?: LogContext): void {
    emit("warn", message, context);
  },
  /** `error` est optionnel : certains appels loguent une anomalie sans exception JS associée. */
  error(message: string, error?: unknown, context?: LogContext): void {
    emit("error", message, { ...context, error: serializeError(error) });
    void reportToSentry(message, error, context);
  },
};

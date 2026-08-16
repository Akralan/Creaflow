import * as Sentry from "@sentry/nextjs";

// register() est appelé une seule fois au démarrage du serveur — charge la config Sentry propre
// à chaque runtime (Node vs Edge). Sans SENTRY_DSN défini, Sentry.init() ci-dessous s'exécute
// avec dsn: undefined, ce qui désactive silencieusement l'envoi d'événements (comportement
// documenté du SDK) — aucune branche conditionnelle nécessaire ici.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture automatiquement les erreurs serveur non gérées (Server Components, Route Handlers,
// Server Actions) que handleApiError (src/lib/api/errors.ts) ne voit pas — celui-ci ne couvre que
// les routes API qui l'appellent explicitement dans leur catch.
export const onRequestError = Sentry.captureRequestError;

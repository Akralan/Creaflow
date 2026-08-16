"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Ne couvre que les erreurs dans le root layout lui-même (rarissime) — error.tsx couvre tout le
// reste. Rendu de document séparé sans les styles/polices globaux (limite documentée de Next.js),
// donc styles minimaux en dur plutôt que les tokens de design habituels de l'app.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f4ef", color: "#1c1917" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 440, textAlign: "center" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>Une erreur est survenue</h1>
            <p style={{ color: "#78706a", fontSize: 14, margin: "0 0 24px" }}>
              Le problème a été signalé automatiquement.
            </p>
            <button
              onClick={reset}
              style={{
                background: "oklch(0.55 0.2 292)",
                color: "#fff",
                border: "none",
                borderRadius: 11,
                padding: "12px 22px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

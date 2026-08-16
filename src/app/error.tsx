"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { color, fontHeading } from "@/lib/design/tokens";

// Attrape les erreurs de rendu non gérées sous ce segment (tout sauf le root layout lui-même,
// couvert par global-error.tsx). `reset` (plutôt que le plus récent `unstable_retry`) — API stable.
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: color.pageBg, padding: 24 }}>
      <Card style={{ maxWidth: 440, padding: 32, textAlign: "center" }}>
        <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 22, margin: "0 0 10px" }}>
          Une erreur est survenue
        </h1>
        <p style={{ color: color.textMuted, fontSize: 14, margin: "0 0 6px" }}>
          Le problème a été signalé automatiquement.
        </p>
        {error.digest && (
          <p style={{ color: color.textFaint, fontSize: 12, margin: "0 0 24px", fontFamily: "monospace" }}>
            Référence : {error.digest}
          </p>
        )}
        <Button onClick={reset}>Réessayer</Button>
      </Card>
    </div>
  );
}

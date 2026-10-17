"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { color, fontHeading } from "@/lib/design/tokens";

// Catches unhandled render errors under this segment (everything except the root layout itself,
// covered by global-error.tsx). `reset` (rather than the newer `unstable_retry`) — stable API.
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: color.pageBg, padding: 24 }}>
      <Card style={{ maxWidth: 440, padding: 32, textAlign: "center" }}>
        <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 22, margin: "0 0 10px" }}>
          Something went wrong
        </h1>
        <p style={{ color: color.textMuted, fontSize: 14, margin: "0 0 6px" }}>
          The problem was reported automatically.
        </p>
        {error.digest && (
          <p style={{ color: color.textFaint, fontSize: 12, margin: "0 0 24px", fontFamily: "monospace" }}>
            Reference: {error.digest}
          </p>
        )}
        <Button onClick={reset}>Try again</Button>
      </Card>
    </div>
  );
}

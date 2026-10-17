"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Only covers errors in the root layout itself (very rare) — error.tsx covers everything
// else. Separate document render without the global styles/fonts (documented Next.js limitation),
// hence minimal hard-coded styles rather than the app's usual design tokens.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f4ef", color: "#1c1917" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ maxWidth: 440, textAlign: "center" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>Something went wrong</h1>
            <p style={{ color: "#78706a", fontSize: 14, margin: "0 0 24px" }}>
              The problem was reported automatically.
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
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

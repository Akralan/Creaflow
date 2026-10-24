"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import OAuthProviderButtons from "@/components/OAuthProviderButtons";
import { api, ApiClientError } from "@/lib/apiClient";
import { color, fontHeading } from "@/lib/design/tokens";
import Wordmark from "@/components/Wordmark";

// Sign-up is no longer here: it happens on the first onboarding screen, by connecting your
// material (docs/SPEC_ONBOARDING_MVP.md §2). `/login?mode=signup`, still linked from the landing,
// redirects there. Signing in is a link sent by email, never a password (docs/SPEC_CONNEXION_PAR_LIEN.md).

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => searchParams.get("oauthError"));
  const [notice] = useState<string | null>(() =>
    searchParams.get("deleted") ? "Your account has been deleted. A confirmation email has been sent to you." : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("mode") === "signup") router.replace("/onboarding");
  }, [router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.requestLoginLink(email);
      setSentTo(email);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        background: `radial-gradient(120% 90% at 15% 10%, oklch(0.95 0.03 292) 0%, ${color.pageBg} 55%)`,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 32 }}>
          <Wordmark size={30} />
        </div>

        <Card style={{ borderRadius: 20, padding: 32, boxShadow: "0 20px 40px -24px rgba(40,30,60,0.2)" }}>
          <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 26, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {sentTo ? "Check your inbox" : "Welcome back"}
          </h1>
          <p style={{ margin: "0 0 26px", color: color.textMuted, fontSize: 15 }}>
            {sentTo
              ? `If ${sentTo} has an account, a sign-in link is on its way. It works once, for 24 hours. Check your spam folder too.`
              : "Enter your email and we'll send you a link to sign in. No password."}
          </p>

          {!sentTo && <OAuthProviderButtons />}

          {sentTo ? (
            <p style={{ margin: 0, fontSize: 14, color: color.textMuted }}>
              Wrong address or nothing arrived?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setSentTo(null);
                }}
              >
                Send another link
              </a>
            </p>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
              <TextField
                label="Email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
              />

              {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}
              {notice && <p style={{ margin: 0, fontSize: 13, color: "oklch(0.5 0.14 150)" }}>{notice}</p>}

              <Button type="submit" fullWidth disabled={loading} style={{ marginTop: 6 }}>
                {loading ? "..." : "Email me a link"}
              </Button>
            </form>
          )}

          <p style={{ textAlign: "center", margin: "20px 0 0", fontSize: 14, color: color.textMuted }}>
            Don&apos;t have an account yet? <a href="/onboarding">Start for free</a>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", width: "100%", background: color.pageBg }} />}>
      <LoginContent />
    </Suspense>
  );
}

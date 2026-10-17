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
// redirects there.
type Mode = "login" | "forgot";

function modeFromParam(value: string | null): Mode {
  return value === "forgot" ? value : "login";
}

const titles: Record<Mode, { heading: string; sub: string }> = {
  login: { heading: "Welcome back", sub: "Log in to get back to your calendar." },
  forgot: { heading: "Forgot your password?", sub: "Enter your email address and we'll send you a link to choose a new one." },
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setModeState] = useState<Mode>(() => modeFromParam(searchParams.get("mode")));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => searchParams.get("oauthError"));
  const [notice, setNotice] = useState<string | null>(() =>
    searchParams.get("deleted") ? "Your account has been deleted. A confirmation email has been sent to you." : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("mode") === "signup") router.replace("/onboarding");
  }, [router, searchParams]);

  function setMode(next: Mode) {
    setModeState(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        await api.forgotPassword(email);
        // Same message whatever the address: the route doesn't reveal who is registered.
        setNotice("If an account exists with this address, an email is on its way. Be sure to check your spam folder.");
        return;
      }
      await api.login(email, password);
      const { profile } = await api.getProfile();
      router.push(profile ? "/calendar" : "/onboarding");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const switchLink = (target: Mode, label: string) => (
    <a href="#" onClick={(e) => { e.preventDefault(); setMode(target); }}>
      {label}
    </a>
  );

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
            {titles[mode].heading}
          </h1>
          <p style={{ margin: "0 0 26px", color: color.textMuted, fontSize: 15 }}>{titles[mode].sub}</p>

          {mode !== "forgot" && <OAuthProviderButtons />}

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
            {mode !== "forgot" && (
              <div>
                <TextField
                  label="Password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                />
                <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0 0", fontSize: 12 }}>
                  <span style={{ color: color.textFaint }}>8 characters minimum</span>
                  {mode === "login" && switchLink("forgot", "Forgot your password?")}
                </div>
              </div>
            )}


            {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}
            {notice && <p style={{ margin: 0, fontSize: 13, color: "oklch(0.5 0.14 150)" }}>{notice}</p>}

            <Button type="submit" fullWidth disabled={loading} style={{ marginTop: 6 }}>
              {loading ? "..." : mode === "login" ? "Log in" : "Send the link"}
            </Button>
          </form>

          <p style={{ textAlign: "center", margin: "20px 0 0", fontSize: 14, color: color.textMuted }}>
            {mode === "login" && <>Don&apos;t have an account yet? <a href="/onboarding">Start for free</a></>}
            {mode === "forgot" && <>{switchLink("login", "Back to log in")}</>}
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

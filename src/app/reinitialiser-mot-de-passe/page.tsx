"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { api, ApiClientError } from "@/lib/apiClient";
import { color, fontHeading } from "@/lib/design/tokens";
import BrandMark from "@/components/BrandMark";

// Landing page for the link received by email (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.3). Same look
// as /login: the user arrives signed out, without the app menu.
function ResetContent() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    if (!token) return;
    setLoading(true);
    try {
      await api.resetPassword(token, password);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
      setLoading(false);
      return;
    }
    // From here the password is changed and the session is set: whatever happens next,
    // we go into the app — otherwise the user would retry with an already used link.
    const profile = await api.getProfile().then((r) => r.profile).catch(() => null);
    router.push(profile ? "/calendar" : "/onboarding");
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
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11, fontFamily: fontHeading, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", color: color.text, textDecoration: "none" }}>
          <BrandMark size={38} />
          Buildloud
        </Link>
        <Card style={{ borderRadius: 20, padding: 32, marginTop: 24, boxShadow: "0 20px 40px -24px rgba(40,30,60,0.2)" }}>
          <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 26, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            New password
          </h1>
          {!token ? (
            <p style={{ margin: "0", color: color.textMuted, fontSize: 15 }}>
              This link is incomplete. Make a new request from the{" "}
              <Link href="/login?mode=forgot">log in page</Link>.
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 26px", color: color.textMuted, fontSize: 15 }}>
                Choose one and you&apos;ll be logged in right away.
              </p>
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
                <TextField
                  label="New password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helper="8 characters minimum"
                />
                <TextField
                  label="Confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}
                <Button type="submit" fullWidth disabled={loading} style={{ marginTop: 6 }}>
                  {loading ? "..." : "Save and log me in"}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", width: "100%", background: color.pageBg }} />}>
      <ResetContent />
    </Suspense>
  );
}

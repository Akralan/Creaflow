"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { api, ApiClientError } from "@/lib/apiClient";
import { accent, color, fontHeading } from "@/lib/design/tokens";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(() =>
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [githubConfigured, setGithubConfigured] = useState(false);

  useEffect(() => {
    // Silencieux en cas d'échec : l'absence de GitHub ne doit jamais casser la page de connexion.
    api
      .getGithubStatus()
      .then(({ configured }) => setGithubConfigured(configured))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "signup" && !legalAccepted) {
      setError("Merci d'accepter les CGU et la politique de confidentialité pour créer un compte.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await api.login(email, password);
      } else {
        await api.signup(email, password);
      }
      const { profile } = await api.getProfile();
      router.push(profile ? "/calendar" : "/onboarding");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        height: "100vh",
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
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: accent,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontFamily: fontHeading,
              fontWeight: 700,
              fontSize: 20,
            }}
          >
            C
          </div>
          <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em" }}>
            CreaFlow
          </span>
        </div>

        <Card style={{ borderRadius: 20, padding: 32, boxShadow: "0 20px 40px -24px rgba(40,30,60,0.2)" }}>
          <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 26, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {mode === "login" ? "Content de vous revoir" : "Créer votre compte"}
          </h1>
          <p style={{ margin: "0 0 26px", color: color.textMuted, fontSize: 15 }}>
            {mode === "login"
              ? "Connectez-vous pour retrouver votre calendrier."
              : "Quelques secondes pour démarrer."}
          </p>

          {githubConfigured && (
            <>
              <a
                href="/api/auth/github/start"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: `1px solid ${color.border}`,
                  background: color.cardBg,
                  color: color.textSecondary,
                  fontFamily: "inherit",
                  fontSize: 15,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                </svg>
                Continuer avec GitHub
              </a>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
                <div style={{ flex: 1, height: 1, background: color.border }} />
                <span style={{ fontSize: 12, color: color.textFaint }}>ou</span>
                <div style={{ flex: 1, height: 1, background: color.border }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <TextField
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="marie@atelier-lumen.fr"
            />
            <div>
              <TextField
                label="Mot de passe"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
              />
              <p style={{ margin: "8px 0 0", fontSize: 12, color: color.textFaint }}>8 caractères minimum</p>
            </div>

            {mode === "signup" && (
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: color.textMuted, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={legalAccepted}
                  onChange={(e) => setLegalAccepted(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  J&apos;accepte les{" "}
                  <a href="/legal/cgu" target="_blank" rel="noopener noreferrer">
                    CGU
                  </a>{" "}
                  et la{" "}
                  <a href="/legal/confidentialite" target="_blank" rel="noopener noreferrer">
                    politique de confidentialité
                  </a>
                  .
                </span>
              </label>
            )}

            {error && (
              <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>
            )}

            <Button type="submit" fullWidth disabled={loading} style={{ marginTop: 6 }}>
              {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <p style={{ textAlign: "center", margin: "20px 0 0", fontSize: 14, color: color.textMuted }}>
            {mode === "login" ? (
              <>
                Pas encore de compte ?{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); setMode("signup"); setError(null); }}>
                  Créer un compte
                </a>
              </>
            ) : (
              <>
                Déjà un compte ?{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); setError(null); }}>
                  Se connecter
                </a>
              </>
            )}
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

"use client";

import { Suspense, useState } from "react";
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

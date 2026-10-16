"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import OAuthProviderButtons from "@/components/OAuthProviderButtons";
import { api, ApiClientError } from "@/lib/apiClient";
import { color, fontHeading } from "@/lib/design/tokens";
import BrandMark from "@/components/BrandMark";

type Mode = "login" | "signup" | "forgot";

function modeFromParam(value: string | null): Mode {
  return value === "signup" || value === "forgot" ? value : "login";
}

const titles: Record<Mode, { heading: string; sub: string }> = {
  login: { heading: "Content de vous revoir", sub: "Connectez-vous pour retrouver votre calendrier." },
  signup: { heading: "Créer votre compte", sub: "Quelques secondes pour démarrer." },
  forgot: { heading: "Mot de passe oublié", sub: "Indiquez votre adresse, vous recevrez un lien pour en choisir un nouveau." },
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setModeState] = useState<Mode>(() => modeFromParam(searchParams.get("mode")));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() =>
    searchParams.get("deleted") ? "Votre compte a été supprimé. Un email de confirmation vous a été envoyé." : null
  );
  const [loading, setLoading] = useState(false);

  function setMode(next: Mode) {
    setModeState(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === "signup" && !legalAccepted) {
      setError("Merci d'accepter les conditions générales et la politique de confidentialité pour créer un compte.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "forgot") {
        await api.forgotPassword(email);
        // Même message quelle que soit l'adresse : la route ne dit pas qui est inscrit.
        setNotice("Si un compte existe avec cette adresse, un email vient de partir. Pensez à vérifier vos indésirables.");
        return;
      }
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
          <BrandMark size={38} />
          <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em" }}>
            CreaFlow
          </span>
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
              placeholder="marie@atelier-lumen.fr"
            />
            {mode !== "forgot" && (
              <div>
                <TextField
                  label="Mot de passe"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                />
                <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0 0", fontSize: 12 }}>
                  <span style={{ color: color.textFaint }}>8 caractères minimum</span>
                  {mode === "login" && switchLink("forgot", "Mot de passe oublié ?")}
                </div>
              </div>
            )}

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
                    conditions générales
                  </a>{" "}
                  et la{" "}
                  <a href="/legal/confidentialite" target="_blank" rel="noopener noreferrer">
                    politique de confidentialité
                  </a>
                  .
                </span>
              </label>
            )}

            {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}
            {notice && <p style={{ margin: 0, fontSize: 13, color: "oklch(0.5 0.14 150)" }}>{notice}</p>}

            <Button type="submit" fullWidth disabled={loading} style={{ marginTop: 6 }}>
              {loading ? "..." : mode === "login" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Recevoir le lien"}
            </Button>
          </form>

          <p style={{ textAlign: "center", margin: "20px 0 0", fontSize: 14, color: color.textMuted }}>
            {mode === "login" && <>Pas encore de compte ? {switchLink("signup", "Créer un compte")}</>}
            {mode === "signup" && <>Déjà un compte ? {switchLink("login", "Se connecter")}</>}
            {mode === "forgot" && <>{switchLink("login", "Retour à la connexion")}</>}
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

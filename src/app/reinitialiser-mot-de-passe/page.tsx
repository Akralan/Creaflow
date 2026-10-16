"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { api, ApiClientError } from "@/lib/apiClient";
import { color, fontHeading } from "@/lib/design/tokens";

// Page d'atterrissage du lien reçu par email (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.3). Même habillage
// que /login : l'utilisateur arrive déconnecté, il n'a pas le menu de l'app.
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
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!token) return;
    setLoading(true);
    try {
      await api.resetPassword(token, password);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Une erreur est survenue.");
      setLoading(false);
      return;
    }
    // À partir d'ici le mot de passe est changé et la session posée : quoi qu'il arrive ensuite,
    // on entre dans l'app — sinon l'utilisateur réessaierait avec un lien déjà consommé.
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
        <Link href="/" style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", color: color.text, textDecoration: "none" }}>
          CreaFlow
        </Link>
        <Card style={{ borderRadius: 20, padding: 32, marginTop: 24, boxShadow: "0 20px 40px -24px rgba(40,30,60,0.2)" }}>
          <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 26, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Nouveau mot de passe
          </h1>
          {!token ? (
            <p style={{ margin: "0", color: color.textMuted, fontSize: 15 }}>
              Ce lien est incomplet. Refaites une demande depuis la{" "}
              <Link href="/login?mode=forgot">page de connexion</Link>.
            </p>
          ) : (
            <>
              <p style={{ margin: "0 0 26px", color: color.textMuted, fontSize: 15 }}>
                Choisissez-le, vous serez connecté dans la foulée.
              </p>
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
                <TextField
                  label="Nouveau mot de passe"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helper="8 caractères minimum"
                />
                <TextField
                  label="Confirmer"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}
                <Button type="submit" fullWidth disabled={loading} style={{ marginTop: 6 }}>
                  {loading ? "..." : "Enregistrer et me connecter"}
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

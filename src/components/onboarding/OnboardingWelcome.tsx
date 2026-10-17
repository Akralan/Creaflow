"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import StepHeading from "@/components/onboarding/StepHeading";
import { PROVIDER_ICONS } from "@/components/OAuthProviderButtons";
import { api, ApiClientError } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";

/** URL de départ OAuth d'un fournisseur, avec retour sur l'écran des sources. GitHub garde sa route
 *  historique : son URL de callback est déposée sur github.com. */
export function oauthStartUrl(providerId: string, returnTo = "/onboarding?step=sources"): string {
  const base = providerId === "github" ? "/api/auth/github/start" : `/api/auth/oauth/${providerId}/start`;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

const doorStyle = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  padding: "14px 16px",
  borderRadius: 12,
  border: `1px solid ${active ? accent : color.border}`,
  background: active ? accentAlpha(0.06) : color.cardBg,
  color: color.textSecondary,
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
  textAlign: "left",
});

const NOTES_ICON = (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <path d="M4 1.5h5.5L13 5v9.5H4z" />
    <path d="M9.5 1.5V5H13M6 8h5M6 10.5h5" />
  </svg>
);

/**
 * Écran 1 (docs/SPEC_ONBOARDING_MVP.md §2) : le nom et les quatre portes. C'est aussi la page
 * d'inscription — cliquer GitHub, Notion ou Linear crée le compte ; l'email n'est demandé que pour
 * « Coller mes notes ».
 */
export default function OnboardingWelcome({
  signedIn,
  connectedProviderIds,
  name,
  onNameChange,
  onNotesChosen,
  onProceed,
}: {
  signedIn: boolean;
  connectedProviderIds: string[];
  name: string;
  onNameChange: (name: string) => void;
  /** La personne a choisi « Coller mes notes » et possède un compte (déjà, ou à l'instant). */
  onNotesChosen: () => void;
  /** Revenir sur cet écran avec un compte déjà branché : la porte mène aux sources, sans refaire
   *  le trajet OAuth. */
  onProceed: () => void;
}) {
  const [providers, setProviders] = useState<Array<{ id: string; displayName: string }>>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Silencieux : sans fournisseur configuré, la porte « notes » suffit à démarrer.
    api
      .getOAuthProviders()
      .then(({ providers }) => setProviders(providers))
      .catch(() => {});
  }, []);

  function chooseNotes() {
    if (signedIn) onNotesChosen();
    else setEmailOpen(true);
  }

  async function signup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!legalAccepted) {
      setError("Please accept the terms and the privacy policy.");
      return;
    }
    setLoading(true);
    try {
      await api.signup(email, password);
      onNotesChosen();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <StepHeading title="Let's start with you">
        Connect what you&apos;re already working on. Buildloud reads it and turns it into your posts.
      </StepHeading>

      <TextField
        label="What's your name?"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Alex Morgan"
        autoComplete="name"
      />

      <div style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary, margin: "24px 0 10px" }}>
        Where is your work?
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {providers.map((provider) => {
          const connected = connectedProviderIds.includes(provider.id);
          if (connected) {
            return (
              <button key={provider.id} type="button" onClick={onProceed} style={doorStyle(true)}>
                {PROVIDER_ICONS[provider.id] ?? null}
                <span style={{ flex: 1 }}>{provider.displayName}</span>
                <span style={{ fontSize: 12, color: accent }}>Connected ✓</span>
              </button>
            );
          }
          return (
            <a key={provider.id} href={oauthStartUrl(provider.id)} style={doorStyle(false)}>
              {PROVIDER_ICONS[provider.id] ?? null}
              <span style={{ flex: 1 }}>{provider.displayName}</span>
            </a>
          );
        })}
        <button type="button" onClick={chooseNotes} style={doorStyle(emailOpen)}>
          {NOTES_ICON}
          <span style={{ flex: 1 }}>Paste my notes</span>
        </button>
      </div>

      {emailOpen && !signedIn && (
        <form onSubmit={signup} style={{ display: "grid", gap: 14, marginTop: 20 }}>
          <p style={{ margin: 0, fontSize: 14, color: color.textMuted }}>
            You need an account to keep your notes.
          </p>
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helper="At least 8 characters"
          />
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: color.textMuted, cursor: "pointer" }}>
            <input type="checkbox" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              I accept the{" "}
              <a href="/legal/cgu" target="_blank" rel="noopener noreferrer">
                terms of service
              </a>{" "}
              and the{" "}
              <a href="/legal/confidentialite" target="_blank" rel="noopener noreferrer">
                privacy policy
              </a>
              .
            </span>
          </label>
          {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Create my account"}
          </Button>
        </form>
      )}

      {!signedIn && (
        <p style={{ fontSize: 12, color: color.textFaint, margin: "18px 0 0", lineHeight: 1.5 }}>
          By continuing with GitHub, Notion or Linear, you accept the{" "}
          <a href="/legal/cgu" target="_blank" rel="noopener noreferrer">
            terms of service
          </a>{" "}
          and the{" "}
          <a href="/legal/confidentialite" target="_blank" rel="noopener noreferrer">
            privacy policy
          </a>
          . Already have an account? <a href="/login">Log in</a>
        </p>
      )}
    </div>
  );
}

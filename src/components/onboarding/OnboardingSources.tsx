"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/TextField";
import StepHeading from "@/components/onboarding/StepHeading";
import RepoPicker from "@/components/RepoPicker";
import SourcePicker from "@/components/SourcePicker";
import { PROVIDER_ICONS } from "@/components/OAuthProviderButtons";
import { oauthStartUrl } from "@/components/onboarding/OnboardingWelcome";
import { api, ApiClientError, type OnboardingState } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

type SignedInState = Extract<OnboardingState, { signedIn: true }>;

/** Les fournisseurs proposés en « Ajoute aussi… » : seuls ceux configurés sur l'environnement. */
const PROVIDER_LABELS: Record<string, string> = { github: "GitHub", notion: "Notion", linear: "Linear" };

/** Éléments cochés d'avance dans chaque sélecteur : les plus récents (spec §2 écran 2). */
const PRESELECT = 2;

const sectionTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  fontWeight: 700,
  color: color.textSecondary,
  margin: "0 0 12px",
};

/**
 * Écran 2 : ce qu'on lit. Un sélecteur par compte branché, la zone de notes, et les portes pas
 * encore branchées — la personne est connectée, un nouveau branchement se rattache à son compte.
 */
export default function OnboardingSources({
  state,
  configuredProviderIds,
  notesOpenInitially,
  onChanged,
}: {
  state: SignedInState;
  configuredProviderIds: string[];
  notesOpenInitially: boolean;
  /** Une source ou une note vient d'être ajoutée : la page relit l'état. */
  onChanged: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(notesOpenInitially || state.notes.length > 0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connected = state.connectedProviders.map((p) => p.id);
  const missing = configuredProviderIds.filter((id) => !connected.includes(id));

  async function addNotes() {
    setSaving(true);
    setError(null);
    try {
      await api.addOnboardingNotes(notes);
      setNotes("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save your notes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <StepHeading title="What we read">
        Check what you want to talk about. The most recent items are already checked.
      </StepHeading>

      {state.sources.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={sectionTitle}>Already connected</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {state.sources.map((source) => (
              <span
                key={source.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "6px 10px", borderRadius: 20, background: color.chipBg, color: color.textSecondary }}
              >
                {PROVIDER_ICONS[source.provider] ?? null}
                {source.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {state.connectedProviders.map((provider) => (
        <div key={provider.id} style={{ marginBottom: 28 }}>
          <div style={sectionTitle}>
            {PROVIDER_ICONS[provider.id] ?? null}
            {provider.displayName}
          </div>
          {provider.id === "github" ? (
            <RepoPicker onConnected={onChanged} preselect={PRESELECT} />
          ) : (
            <SourcePicker key={provider.id} provider={provider.id} onConnected={onChanged} preselect={PRESELECT} />
          )}
        </div>
      ))}

      <div style={{ marginBottom: 24 }}>
        <div style={sectionTitle}>Your notes</div>
        {state.notes.map((note) => (
          <p key={note.id} style={{ fontSize: 13, color: color.textMuted, margin: "0 0 8px", fontStyle: "italic" }}>
            &ldquo;{note.excerpt}
            {note.excerpt.length >= 160 ? "…" : ""}&rdquo;
          </p>
        ))}
        {notesOpen ? (
          <div style={{ display: "grid", gap: 10 }}>
            <TextAreaField
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste a devlog, project notes, a meeting recap… Anything that tells what you do."
              style={{ minHeight: 140 }}
            />
            {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}
            <div>
              <Button variant="secondary" onClick={addNotes} disabled={saving || !notes.trim()}>
                {saving ? "..." : "Add these notes"}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setNotesOpen(true)}>
            Paste my notes
          </Button>
        )}
      </div>

      {missing.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: 14, color: color.textMuted }}>
          Also add:
          {missing.map((id) => (
            <a
              key={id}
              href={oauthStartUrl(id)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, border: `1px solid ${color.border}`, color: color.textSecondary, textDecoration: "none", fontWeight: 600 }}
            >
              {PROVIDER_ICONS[id] ?? null}
              {PROVIDER_LABELS[id] ?? id}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

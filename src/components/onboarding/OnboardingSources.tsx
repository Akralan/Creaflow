"use client";

import { useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/TextField";
import StepHeading from "@/components/onboarding/StepHeading";
import RepoPicker from "@/components/RepoPicker";
import SourcePicker from "@/components/SourcePicker";
import { PROVIDER_ICONS } from "@/components/OAuthProviderButtons";
import { oauthStartUrl } from "@/components/onboarding/OnboardingWelcome";
import { api, ApiClientError, type OnboardingState } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";

const TEXT_FILE = /\.(md|markdown|txt)$/i;
/** Same ceiling as the notes route (src/app/api/onboarding/notes/route.ts). */
const MAX_NOTE_CHARS = 100_000;

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
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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

  /** Each dropped text file becomes one note block, in drop order. */
  async function addFiles(files: File[]) {
    const accepted = files.filter((f) => TEXT_FILE.test(f.name) || f.type.startsWith("text/"));
    if (accepted.length === 0) {
      setError("Drop .md or .txt files.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const file of accepted) {
        const text = await file.text();
        if (!text.trim()) continue;
        if (text.length > MAX_NOTE_CHARS) throw new Error(`${file.name} is too long (100,000 characters at most).`);
        await api.addOnboardingNotes(text);
        onChanged();
      }
      if (accepted.length < files.length) setError("Only .md and .txt files were added.");
    } catch (err) {
      setError(err instanceof ApiClientError || err instanceof Error ? err.message : "Couldn't save your notes.");
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
        <div
          data-testid="notes-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void addFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => fileInput.current?.click()}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "22px 16px",
            marginBottom: 14,
            borderRadius: 14,
            border: `2px dashed ${dragOver ? accent : color.border}`,
            background: dragOver ? accentAlpha(0.06) : color.cardBg,
            color: color.textMuted,
            fontSize: 14,
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color .15s, background .15s",
          }}
        >
          <strong style={{ color: color.textSecondary, fontSize: 15 }}>
            {saving ? "Adding…" : dragOver ? "Drop to add" : "Drop your notes here"}
          </strong>
          <span>.md or .txt files — or click to browse</span>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".md,.markdown,.txt,text/*"
            hidden
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
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

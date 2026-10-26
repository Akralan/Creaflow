"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField, TextAreaField, SelectField, heading1Style } from "@/components/ui/TextField";
import ConnectionRow from "@/components/ConnectionRow";
import StyleAnalysisPanel from "@/components/StyleAnalysisPanel";
import BrandAssetLibrary from "@/components/BrandAssetLibrary/BrandAssetLibrary";
import BillingPanel from "@/components/BillingPanel";
import BrandKitPanel from "@/components/BrandKitPanel";
import AccountPanel from "@/components/AccountPanel";
import { api, ApiClientError, type Connection } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";
import { POST_LANGUAGES, isPostLanguage } from "@/lib/language";

type Tab = "identity" | "assets" | "connexions" | "billing" | "account";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "identity", label: "Brand identity" },
  { id: "assets", label: "Visual assets" },
  { id: "connexions", label: "Social connections" },
  { id: "billing", label: "Billing" },
  // The person, not their brand (docs/SPEC_LEGAL_EMAIL_RGPD.md §1): email, export, deletion.
  { id: "account", label: "Account" },
];

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: "none",
        fontFamily: "inherit",
        fontSize: 15,
        padding: "12px 16px",
        cursor: "pointer",
        marginBottom: -1,
        color: active ? "oklch(0.47 0.2 292)" : color.textMuted,
        fontWeight: active ? 600 : 500,
        borderBottom: active ? "2px solid oklch(0.55 0.2 292)" : "2px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

function IdentityTab() {
  const [brandName, setBrandName] = useState("");
  const [activityType, setActivityType] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [expectations, setExpectations] = useState("");
  // "" = automatic: the language of the notes.
  const [language, setLanguage] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile().then(({ profile }) => {
      if (profile) {
        setBrandName(profile.brandName);
        setActivityType(profile.activityType);
        setTargetAudience(profile.targetAudience || "");
        setExpectations(profile.expectations || "");
        setLanguage(isPostLanguage(profile.language) ? profile.language : "");
        setXHandle(profile.xHandle ? `@${profile.xHandle}` : "");
      }
      setLoaded(true);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.saveProfile({ brandName, activityType, targetAudience, expectations, language: language || null, xHandle });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div style={{ display: "grid", gap: 20 }}>
    <Card style={{ padding: 28, display: "grid", gap: 20 }}>
      <TextField label="Your name" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
      <TextField label="Type of work" value={activityType} onChange={(e) => setActivityType(e.target.value)} />
      <TextAreaField
        label="Target audience"
        value={targetAudience}
        onChange={(e) => setTargetAudience(e.target.value)}
        placeholder="Who buys or reads, what they care about, what they should remember about the brand"
      />
      {/* Tone is no longer asked for: it is learned from edits (docs/SPEC_ONBOARDING_MVP.md §1). */}
      <TextAreaField
        label="What you expect from Tellovo"
        value={expectations}
        onChange={(e) => setExpectations(e.target.value)}
        placeholder="I want to publish every week without spending my evenings on it, and have people follow my product being built all the way to launch."
      />
      <SelectField
        label="Language of your posts"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        helper="Automatic follows the language of your notes. Pick one to always write in it, whatever your notes are in."
      >
        <option value="">Automatic (language of my notes)</option>
        {POST_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Your X handle"
        value={xHandle}
        onChange={(e) => setXHandle(e.target.value)}
        placeholder="@yourname"
        helper="Used to read the numbers of your posts on X (views, likes, replies, reposts). Only public numbers are read."
      />
      {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8, borderTop: `1px solid ${color.dividerAlt}`, marginTop: 4 }}>
        <Button onClick={handleSave} disabled={saving} style={{ padding: "11px 22px", fontSize: 14 }}>
          {saving ? "..." : "Save"}
        </Button>
        {saved && <span style={{ fontSize: 13, color: "oklch(0.5 0.14 150)" }}>Saved.</span>}
      </div>
    </Card>
    <BrandKitPanel />
    </div>
  );
}

function ConnexionsTab() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getConnections().then(({ connections }) => {
      setConnections(connections);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return null;

  return (
    <div>
      <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
        {connections.map((c) => (
          <ConnectionRow key={c.platform} connection={c} returnTo="/settings" />
        ))}
      </div>
      <StyleAnalysisPanel />
    </div>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const requested = searchParams.get("tab");
    if (requested && tabs.some((t) => t.id === requested)) return requested as Tab;
    return searchParams.get("connected") ? "connexions" : "identity";
  });

  return (
    <div style={{ padding: "32px 36px", maxWidth: 820 }}>
      <h1 style={{ ...heading1Style, marginBottom: 20 }}>Settings</h1>
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${color.border}`, marginBottom: 28 }}>
        {tabs.map((t) => (
          <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </TabButton>
        ))}
      </div>

      {tab === "identity" && <IdentityTab />}
      {tab === "assets" && <BrandAssetLibrary />}
      {tab === "connexions" && <ConnexionsTab />}
      {tab === "billing" && <BillingPanel />}
      {tab === "account" && <AccountPanel />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}

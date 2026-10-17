"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField, TextAreaField, heading1Style } from "@/components/ui/TextField";
import ProductCatalogue from "@/components/ProductCatalogue";
import RepoPicker from "@/components/RepoPicker";
import SourcePicker from "@/components/SourcePicker";
import ConnectionRow from "@/components/ConnectionRow";
import PublishingDaysPicker from "@/components/PublishingDaysPicker";
import StyleAnalysisPanel from "@/components/StyleAnalysisPanel";
import BrandAssetLibrary from "@/components/BrandAssetLibrary/BrandAssetLibrary";
import BillingPanel from "@/components/BillingPanel";
import BrandKitPanel from "@/components/BrandKitPanel";
import AccountPanel from "@/components/AccountPanel";
import { api, ApiClientError, type Connection } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";
import { DEFAULT_PUBLISHING_DAYS } from "@/lib/validation";

type Tab = "identity" | "catalogue" | "assets" | "connexions" | "billing" | "account";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "identity", label: "Brand identity" },
  { id: "catalogue", label: "Topics" },
  { id: "assets", label: "Visual assets" },
  { id: "connexions", label: "Social connections" },
  { id: "billing", label: "Billing" },
  // The person, not their brand (docs/SPEC_LEGAL_EMAIL_RGPD.md §1): password, export, deletion.
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
  const [publishingDays, setPublishingDays] = useState<number[]>(DEFAULT_PUBLISHING_DAYS);
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
        setPublishingDays(profile.publishingDays.length > 0 ? profile.publishingDays : DEFAULT_PUBLISHING_DAYS);
      }
      setLoaded(true);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.saveProfile({ brandName, activityType, targetAudience, expectations, publishingDays });
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
      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 4 }}>
          Days you can publish
        </label>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: color.textMuted }}>
          Suggested when you create a series. Each series then has its own rhythm, in Direction.
        </p>
        <PublishingDaysPicker value={publishingDays} onChange={setPublishingDays} />
      </div>
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

/** One card per connected provider, above the manual catalogue: plug in new
 *  sources as topics without redoing onboarding. The catalogue is remounted (key) after each
 *  connection to reflect the freshly created topics. */
function ConnectorCard({
  provider,
  onConnected,
}: {
  provider: { id: string; displayName: string };
  onConnected: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const isGithub = provider.id === "github";
  const label = provider.displayName;

  return (
    <Card style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Add from {label}</div>
          <div style={{ fontSize: 13, color: color.textMuted, marginTop: 2 }}>
            Each item you pick becomes a topic, with its content as material.
          </div>
        </div>
        <Button variant="secondary" onClick={() => setShowPicker((v) => !v)}>
          {showPicker ? "Hide" : "Choose"}
        </Button>
      </div>
      {showPicker && (
        <div style={{ marginTop: 18 }}>
          {/* GitHub keeps its legacy picker: its route carries the "repo" shape, tested separately. */}
          {isGithub ? (
            <RepoPicker variant="settings" onConnected={onConnected} />
          ) : (
            <SourcePicker key={provider.id} provider={provider.id} variant="settings" onConnected={onConnected} />
          )}
        </div>
      )}
    </Card>
  );
}

function CatalogueTab() {
  const [providers, setProviders] = useState<Array<{ id: string; displayName: string }>>([]);
  const [catalogueKey, setCatalogueKey] = useState(0);

  useEffect(() => {
    // The providers actually linked to the account, not the vertical: "dev" covers GitHub
    // as well as Linear (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.2).
    api.getProfile().then(({ connectedProviders }) => setProviders(connectedProviders));
  }, []);

  return (
    <div>
      {providers.map((provider) => (
        <ConnectorCard key={provider.id} provider={provider} onConnected={() => setCatalogueKey((k) => k + 1)} />
      ))}
      <ProductCatalogue key={catalogueKey} />
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
      {tab === "catalogue" && <CatalogueTab />}
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

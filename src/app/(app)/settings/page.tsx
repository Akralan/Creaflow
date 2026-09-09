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
import EquipmentPicker from "@/components/EquipmentPicker";
import StyleAnalysisPanel from "@/components/StyleAnalysisPanel";
import BrandAssetLibrary from "@/components/BrandAssetLibrary/BrandAssetLibrary";
import BillingPanel from "@/components/BillingPanel";
import { api, ApiClientError, type Connection } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

type Tab = "identity" | "catalogue" | "assets" | "connexions" | "billing";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "identity", label: "Identité de marque" },
  { id: "catalogue", label: "Sujets" },
  { id: "assets", label: "Ressources visuelles" },
  { id: "connexions", label: "Connexions sociales" },
  { id: "billing", label: "Facturation" },
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
  const [tone, setTone] = useState("");
  const [values, setValues] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [weeklyTimeAvailable, setWeeklyTimeAvailable] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile().then(({ profile }) => {
      if (profile) {
        setBrandName(profile.brandName);
        setActivityType(profile.activityType);
        setTone(profile.tone || "");
        setValues(profile.values || "");
        setEquipment(profile.equipment || []);
        setWeeklyTimeAvailable(profile.weeklyTimeAvailable || "");
        setTargetAudience(profile.targetAudience || "");
      }
      setLoaded(true);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.saveProfile({ brandName, activityType, tone, values, equipment, weeklyTimeAvailable, targetAudience });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card style={{ padding: 28, display: "grid", gap: 20 }}>
      <TextField label="Nom de la marque" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <TextField label="Type d'activité" value={activityType} onChange={(e) => setActivityType(e.target.value)} />
        <TextField label="Ton" value={tone} onChange={(e) => setTone(e.target.value)} />
      </div>
      <TextAreaField label="Valeurs" value={values} onChange={(e) => setValues(e.target.value)} />
      <TextAreaField
        label="Audience visée"
        value={targetAudience}
        onChange={(e) => setTargetAudience(e.target.value)}
        placeholder="Qui achète ou lit, ce qui l'intéresse, ce qu'il doit retenir de la marque"
      />
      <div>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 12 }}>
          Matériel
        </label>
        <EquipmentPicker value={equipment} onChange={setEquipment} />
      </div>
      <TextField
        label="Temps de tournage disponible"
        value={weeklyTimeAvailable}
        onChange={(e) => setWeeklyTimeAvailable(e.target.value)}
        style={{ maxWidth: 340 }}
      />
      {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8, borderTop: `1px solid ${color.dividerAlt}`, marginTop: 4 }}>
        <Button onClick={handleSave} disabled={saving} style={{ padding: "11px 22px", fontSize: 14 }}>
          {saving ? "..." : "Enregistrer"}
        </Button>
        {saved && <span style={{ fontSize: 13, color: "oklch(0.5 0.14 150)" }}>Enregistré.</span>}
      </div>
    </Card>
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

/** Une carte par fournisseur connecté, au-dessus du catalogue manuel : brancher de nouvelles
 *  sources comme sujets sans refaire l'onboarding. Le catalogue est remonté (clé) après chaque
 *  connexion pour refléter les sujets fraîchement créés. */
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
          <div style={{ fontWeight: 600, fontSize: 15 }}>Ajouter depuis {label}</div>
          <div style={{ fontSize: 13, color: color.textMuted, marginTop: 2 }}>
            Chaque élément choisi devient un sujet, avec son contenu comme matière.
          </div>
        </div>
        <Button variant="secondary" onClick={() => setShowPicker((v) => !v)}>
          {showPicker ? "Masquer" : "Choisir"}
        </Button>
      </div>
      {showPicker && (
        <div style={{ marginTop: 18 }}>
          {/* GitHub garde son sélecteur historique : sa route porte la forme « dépôt », testée à part. */}
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
    // Les fournisseurs réellement reliés au compte, et non la verticale : "dev" couvre GitHub
    // comme Linear (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.2).
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
      <h1 style={{ ...heading1Style, marginBottom: 20 }}>Paramètres</h1>
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

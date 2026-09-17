"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type BrandAsset, type BrandKit } from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";
import { DESIGN_FONTS } from "@/lib/visualDesign/fonts";

const EMPTY: BrandKit = { primaryColor: null, secondaryColor: null, accentColor: null, fontHeading: null, fontBody: null, logoAssetId: null };

const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: color.textMuted, marginBottom: 4 };
const input: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "inherit",
  background: color.cardBg,
  boxSizing: "border-box",
};

/**
 * Identité de marque des maquettes (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2, §6) : trois couleurs,
 * deux polices, un logo choisi dans la bibliothèque. Tout est optionnel.
 */
export default function BrandKitPanel() {
  const [kit, setKit] = useState<BrandKit>(EMPTY);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getProfile(), api.getAssets()])
      .then(([{ profile }, { assets: list }]) => {
        setKit({ ...EMPTY, ...(profile?.brandKit ?? {}) });
        setAssets(list.filter((a) => a.status === "ready" && a.thumbnailUrl));
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { brandKit } = await api.saveBrandKit(kit);
      setKit({ ...EMPTY, ...brandKit });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  function colorField(key: "primaryColor" | "secondaryColor" | "accentColor", title: string) {
    return (
      <div>
        <div style={label}>{title}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <input type="color" style={{ ...input, width: 44, padding: 2, height: 34 }} value={kit[key] ?? "#000000"} onChange={(e) => setKit({ ...kit, [key]: e.target.value })} />
          <input style={input} value={kit[key] ?? ""} placeholder="#RRGGBB" onChange={(e) => setKit({ ...kit, [key]: e.target.value || null })} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${accentAlpha(0.25)}`, background: accentAlpha(0.06), borderRadius: 14, padding: 16, display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Identité visuelle des maquettes</div>
        <div style={{ fontSize: 12, color: color.textMuted, marginTop: 2 }}>
          Couleurs, polices et logo que l&apos;agent respecte quand il compose un post visuel. Laisse vide pour le laisser choisir.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {colorField("primaryColor", "Couleur dominante")}
        {colorField("secondaryColor", "Couleur secondaire")}
        {colorField("accentColor", "Accent")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={label}>Police des titres</div>
          <select style={input} value={kit.fontHeading ?? ""} onChange={(e) => setKit({ ...kit, fontHeading: e.target.value || null })}>
            <option value="">(au choix de l&apos;agent)</option>
            {DESIGN_FONTS.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={label}>Police du texte</div>
          <select style={input} value={kit.fontBody ?? ""} onChange={(e) => setKit({ ...kit, fontBody: e.target.value || null })}>
            <option value="">(au choix de l&apos;agent)</option>
            {DESIGN_FONTS.map((f) => (
              <option key={f.name} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div style={label}>Logo (une image de la bibliothèque)</div>
        {assets.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: color.textFaint }}>Ajoute d&apos;abord ton logo dans l&apos;onglet Ressources visuelles.</p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {assets.map((a) => (
              <button
                key={a.id}
                onClick={() => setKit({ ...kit, logoAssetId: kit.logoAssetId === a.id ? null : a.id })}
                title={a.aiDescription ?? ""}
                style={{
                  width: 56,
                  height: 56,
                  padding: 0,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: kit.logoAssetId === a.id ? "2px solid oklch(0.55 0.2 292)" : `1px solid ${color.border}`,
                  cursor: "pointer",
                  background: color.cardBg,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.thumbnailUrl ?? ""} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p style={{ margin: 0, fontSize: 12, color: color.danger }}>{error}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button onClick={save} disabled={saving} style={{ padding: "9px 18px", fontSize: 13 }}>
          {saving ? "..." : "Enregistrer l'identité"}
        </Button>
        {saved && <span style={{ fontSize: 13, color: "oklch(0.5 0.14 150)" }}>Enregistré.</span>}
      </div>
    </div>
  );
}

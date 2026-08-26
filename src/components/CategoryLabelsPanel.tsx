"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type ContentCategory } from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

type Draft = {
  id?: string;
  label: string;
  description: string;
  weight: number;
  platforms: string[];
  materialHungry: boolean;
};

function toDrafts(categories: ContentCategory[]): Draft[] {
  return categories.map((c) => ({
    id: c.id,
    label: c.label,
    description: c.description,
    weight: c.weight,
    platforms: c.platforms,
    materialHungry: c.materialHungry,
  }));
}

export default function CategoryLabelsPanel() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const { categories } = await api.generateContentCategories();
      setDrafts(toDrafts(categories));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Génération impossible.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { categories } = await api.getContentCategories();
      if (categories.length > 0) {
        setDrafts(toDrafts(categories));
        setLoaded(true);
      } else {
        setLoaded(true);
        await generate();
      }
    })();
  }, []);

  function updateField(index: number, field: "label" | "description" | "weight", value: string) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: field === "weight" ? Number(value) : value } : d))
    );
  }

  function togglePlatform(index: number, platform: string) {
    setDrafts((prev) =>
      prev.map((d, i) =>
        i === index
          ? {
              ...d,
              platforms: d.platforms.includes(platform)
                ? d.platforms.filter((p) => p !== platform)
                : [...d.platforms, platform],
            }
          : d
      )
    );
  }

  function addCategory() {
    setDrafts((prev) => [...prev, { label: "Nouveau rôle", description: "", weight: 10, platforms: [], materialHungry: false }]);
  }

  function toggleMaterialHungry(index: number) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, materialHungry: !d.materialHungry } : d)));
  }

  function removeCategory(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (drafts.length < 2) {
      setError("Il faut au moins 2 rôles.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { categories } = await api.saveContentCategories(drafts);
      setDrafts(toDrafts(categories));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div style={{ border: `1px solid ${accentAlpha(0.25)}`, background: accentAlpha(0.06), borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Rôles éditoriaux</div>
        <button
          onClick={generate}
          disabled={generating}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "oklch(0.48 0.2 292)",
            background: color.cardBg,
            border: "1px solid oklch(0.6 0.15 292)",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: generating ? "default" : "pointer",
            flexShrink: 0,
          }}
        >
          {generating ? "Génération..." : "Régénérer avec l'IA"}
        </button>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: color.textMuted }}>
        Un rôle dit pourquoi un post existe (expertise, coulisses, preuve sociale…). Libellé, consigne pour l&apos;IA et poids (%) dans le mix ; un rôle porté par une série active ne peut pas être retiré.
      </p>

      {error && <p style={{ margin: "0 0 10px", fontSize: 12, color: color.danger }}>{error}</p>}

      <div style={{ display: "grid", gap: 14, marginBottom: 14 }}>
        {drafts.map((d, i) => (
          <div key={d.id ?? `new-${i}`} style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              value={d.label}
              onChange={(e) => updateField(i, "label", e.target.value)}
              placeholder="Libellé"
              style={{
                flex: 1,
                border: `1px solid ${color.inputBorder}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
                fontFamily: "inherit",
                background: color.cardBg,
              }}
            />
            <input
              value={d.description}
              onChange={(e) => updateField(i, "description", e.target.value)}
              placeholder="Consigne pour l'IA"
              style={{
                flex: 2,
                border: `1px solid ${color.inputBorder}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
                fontFamily: "inherit",
                background: color.cardBg,
              }}
            />
            <input
              type="number"
              min={5}
              max={90}
              value={d.weight}
              onChange={(e) => updateField(i, "weight", e.target.value)}
              style={{
                width: 64,
                border: `1px solid ${color.inputBorder}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
                fontFamily: "inherit",
                background: color.cardBg,
              }}
            />
            <span style={{ fontSize: 12, color: color.textFaint }}>%</span>
            <button
              onClick={() => removeCategory(i)}
              disabled={drafts.length <= 2}
              title="Retirer"
              style={{
                border: "none",
                background: "none",
                color: drafts.length <= 2 ? color.textFainter : color.danger,
                cursor: drafts.length <= 2 ? "default" : "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: "4px 6px",
              }}
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: color.textFaint, marginRight: 2 }}>
              {d.platforms.length === 0 ? "Tous les réseaux" : "Réseaux :"}
            </span>
            {KNOWN_PLATFORMS.map((p) => {
              const active = d.platforms.includes(p.key);
              return (
                <button
                  key={p.key}
                  onClick={() => togglePlatform(i, p.key)}
                  style={{
                    fontSize: 11,
                    fontWeight: active ? 600 : 500,
                    color: active ? "oklch(0.48 0.2 292)" : color.textMuted,
                    background: active ? accentAlpha(0.12) : color.inputBg,
                    border: `1px solid ${active ? "oklch(0.6 0.15 292)" : color.inputBorder}`,
                    borderRadius: 20,
                    padding: "3px 9px",
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              onClick={() => toggleMaterialHungry(i)}
              title="Rôle gourmand en matière — sous-représenté quand le corpus est sec (docs/SPEC_MATIERE_EDITEUR.md §5.3)"
              style={{
                fontSize: 11,
                fontWeight: d.materialHungry ? 600 : 500,
                color: d.materialHungry ? "oklch(0.5 0.14 60)" : color.textMuted,
                background: d.materialHungry ? "oklch(0.6 0.14 60 / 0.12)" : color.inputBg,
                border: `1px solid ${d.materialHungry ? "oklch(0.6 0.14 60)" : color.inputBorder}`,
                borderRadius: 20,
                padding: "3px 9px",
                cursor: "pointer",
                marginLeft: 4,
              }}
            >
              {d.materialHungry ? "◈ Gourmand en matière" : "Gourmand en matière ?"}
            </button>
          </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={addCategory}
          disabled={drafts.length >= 6}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: drafts.length >= 6 ? color.textFainter : color.textSecondary,
            background: "none",
            border: `1px dashed ${color.dashedBorder}`,
            borderRadius: 8,
            padding: "8px 12px",
            cursor: drafts.length >= 6 ? "default" : "pointer",
          }}
        >
          + Ajouter un rôle
        </button>
        <Button onClick={save} disabled={saving} style={{ padding: "8px 16px", fontSize: 13, marginLeft: "auto" }}>
          {saving ? "..." : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

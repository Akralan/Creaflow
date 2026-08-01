"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type CategoryLabels } from "@/lib/apiClient";
import { accentAlpha, color, type ContentCategory } from "@/lib/design/tokens";

const ROLES: Array<{ key: ContentCategory; hint: string }> = [
  { key: "vente", hint: "Rôle promotionnel (offre, produit, annonce)" },
  { key: "coulisses", hint: "Rôle coulisses (processus, humain)" },
  { key: "educatif", hint: "Rôle valeur ajoutée (apprendre, divertir)" },
];

export default function CategoryLabelsPanel() {
  const [labels, setLabels] = useState<CategoryLabels | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const { categoryLabels } = await api.generateCategoryLabels();
      setLabels(categoryLabels);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Génération impossible.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { profile } = await api.getProfile();
      if (profile?.categoryLabels) {
        setLabels(profile.categoryLabels);
        setLoaded(true);
      } else {
        setLoaded(true);
        await generate();
      }
    })();
  }, []);

  function updateField(role: ContentCategory, field: "label" | "weight", value: string) {
    setLabels((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [role]: { ...prev[role], [field]: field === "weight" ? Number(value) : value },
      };
    });
  }

  async function save() {
    if (!labels) return;
    setSaving(true);
    setError(null);
    try {
      const { categoryLabels } = await api.saveCategoryLabels(labels);
      setLabels(categoryLabels);
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
        <div style={{ fontWeight: 600, fontSize: 14 }}>Catégories de contenu adaptées à ton activité</div>
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
        Ces 3 catégories structurent le mix de contenu du calendrier. Modifie le libellé et le poids (%) si besoin.
      </p>

      {error && <p style={{ margin: "0 0 10px", fontSize: 12, color: color.danger }}>{error}</p>}

      {labels && (
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          {ROLES.map(({ key, hint }) => (
            <div key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={labels[key].label}
                onChange={(e) => updateField(key, "label", e.target.value)}
                style={{
                  flex: 1,
                  border: `1px solid ${color.inputBorder}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 13,
                  fontFamily: "inherit",
                  background: color.cardBg,
                }}
                title={hint}
              />
              <input
                type="number"
                min={5}
                max={90}
                value={labels[key].weight}
                onChange={(e) => updateField(key, "weight", e.target.value)}
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
            </div>
          ))}
        </div>
      )}

      <Button onClick={save} disabled={saving || !labels} style={{ padding: "8px 16px", fontSize: 13 }}>
        {saving ? "..." : "Enregistrer"}
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type ContentSeries } from "@/lib/apiClient";
import { accentAlpha, color, fontHeading } from "@/lib/design/tokens";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

/**
 * Édition d'UNE série (docs/SPEC_SERIES_ET_ROLES.md) — ouverte depuis l'icône crayon d'une carte de
 * l'écran Direction, ou en création depuis « Nouvelle série ». Remplace l'ancien formulaire
 * multi-lignes de SeriesPanel, que le passage en master-detail a rendu sans place.
 *
 * `POST /api/series` archive toute série ABSENTE du tableau envoyé : on renvoie donc toujours le jeu
 * actif complet, avec la série éditée remplacée, ajoutée, ou retirée (= archivée) selon le geste.
 */
export default function SeriesEditModal({
  open,
  series,
  allSeries,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = création d'une nouvelle série. */
  series: ContentSeries | null;
  allSeries: ContentSeries[];
  onClose: () => void;
  onSaved: (series: ContentSeries[], removedId?: string) => void;
}) {
  const categories = useContentCategories();
  const [label, setLabel] = useState(series?.label ?? "");
  const [description, setDescription] = useState(series?.description ?? "");
  const [weight, setWeight] = useState(series?.weight ?? 10);
  const [categoryId, setCategoryId] = useState(series?.category?.id ?? "");
  const [platforms, setPlatforms] = useState<string[]>(series?.platforms ?? []);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Forme attendue par `POST /api/series` — `id` absent = création. */
  type SeriesDraft = {
    id?: string;
    label: string;
    description: string;
    weight: number;
    categoryId: string;
    platforms: string[];
  };

  function toDraft(s: ContentSeries): SeriesDraft {
    return {
      id: s.id,
      label: s.label,
      description: s.description,
      weight: s.weight,
      categoryId: s.category?.id ?? "",
      platforms: s.platforms,
    };
  }

  function togglePlatform(platform: string) {
    setPlatforms((prev) => (prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]));
  }

  async function submit(payload: SeriesDraft[], removedId?: string) {
    setSaving(true);
    setError(null);
    try {
      const { series: saved } = await api.saveContentSeries(payload);
      onSaved(saved, removedId);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!label.trim()) {
      setError("Donne un nom à cette série.");
      return;
    }
    if (!categoryId) {
      setError("Chaque série doit avoir un rôle.");
      return;
    }
    const edited = { id: series?.id, label: label.trim(), description: description.trim() || label.trim(), weight, categoryId, platforms };
    const payload = series
      ? allSeries.map((s) => (s.id === series.id ? edited : toDraft(s)))
      : [...allSeries.map(toDraft), edited];
    await submit(payload);
  }

  /** Retirer une série = l'omettre du tableau envoyé, ce qui l'archive côté serveur (jamais de
   *  suppression dure : les scripts et créneaux qui la référencent doivent rester valides). */
  async function remove() {
    if (!series) return;
    await submit(allSeries.filter((s) => s.id !== series.id).map(toDraft), series.id);
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    border: `1px solid ${color.inputBorder}`,
    borderRadius: 9,
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "inherit",
    background: color.inputBg,
    color: color.text,
  };

  return (
    <Modal open={open} onClose={onClose} width={520}>
      <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 19, marginBottom: 4 }}>
        {series ? "Modifier la série" : "Nouvelle série"}
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: color.textMuted, lineHeight: 1.5 }}>
        Un format récurrent et nommé, avec sa propre identité, qui sert un rôle de ton mix. Une partie du calendrier reste
        hors série (posts libres).
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 6 }}>
            Nom de la série
          </label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Le mythe du mercredi" style={fieldStyle} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 6 }}>
            Identité de la série
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Angle, ton, structure à respecter à chaque épisode"
            rows={2}
            style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.45 }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 6 }}>
            Rôle
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {categories.map((c) => {
              const active = c.id === categoryId;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  style={{
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    color: active ? "oklch(0.48 0.2 292)" : color.textMuted,
                    background: active ? accentAlpha(0.12) : color.inputBg,
                    border: `1px solid ${active ? "oklch(0.6 0.15 292)" : color.inputBorder}`,
                    borderRadius: 20,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 6 }}>
              Poids
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                min={0}
                max={100}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                style={{ ...fieldStyle, width: 80 }}
              />
              <span style={{ fontSize: 13, color: color.textFaint }}>% des créneaux</span>
            </div>
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 6 }}>
            Réseaux <span style={{ fontWeight: 400, color: color.textFaint }}>— aucun sélectionné = tous</span>
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {KNOWN_PLATFORMS.map((p) => {
              const active = platforms.includes(p.key);
              return (
                <button
                  key={p.key}
                  onClick={() => togglePlatform(p.key)}
                  style={{
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    color: active ? "oklch(0.48 0.2 292)" : color.textMuted,
                    background: active ? accentAlpha(0.12) : color.inputBg,
                    border: `1px solid ${active ? "oklch(0.6 0.15 292)" : color.inputBorder}`,
                    borderRadius: 20,
                    padding: "5px 11px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && <p style={{ margin: "16px 0 0", fontSize: 13, color: color.danger }}>{error}</p>}

      {confirmingDelete ? (
        <div
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 11,
            background: "oklch(0.62 0.15 25 / 0.07)",
            border: `1px solid ${color.dangerBorder}`,
          }}
        >
          <div style={{ fontSize: 13, color: color.text2, lineHeight: 1.5, marginBottom: 12 }}>
            Retirer <strong>{series?.label}</strong> ? Elle disparaît de la direction et du calendrier à venir. Les scripts
            déjà générés pour cette série sont conservés.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={saving}>
              Annuler
            </Button>
            <button
              onClick={remove}
              disabled={saving}
              style={{
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 600,
                borderRadius: 11,
                padding: "12px 22px",
                border: "none",
                cursor: saving ? "default" : "pointer",
                background: saving ? color.textFaint : color.danger,
                color: "#fff",
              }}
            >
              {saving ? "..." : "Retirer la série"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
          {series && (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={saving}
              title="Retirer cette série"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                color: color.danger,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 4px",
              }}
            >
              <Trash2 size={15} strokeWidth={2} />
              Retirer
            </button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "..." : "Enregistrer"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

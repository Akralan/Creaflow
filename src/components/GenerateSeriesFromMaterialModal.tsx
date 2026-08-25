"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { PlatformBadge } from "@/components/ui/Badge";
import IconActionButton from "@/components/ui/IconActionButton";
import { api, ApiClientError, type Script } from "@/lib/apiClient";
import { accent, accentAlpha, color, fontHeading, platformMeta, type Platform } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { useContentSeries } from "@/contexts/SeriesContext";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

/**
 * Génération de série depuis la matière (docs/SPEC_MATIERE_EDITEUR.md §3.8) — "un effort documenté
 * → plusieurs contenus", le Module C en version texte. Génère N scripts ordonnés rattachés à une
 * même série, à partir du corpus structuré du sujet.
 */
export default function GenerateSeriesFromMaterialModal({
  open,
  onClose,
  productId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  productId?: string;
  onDone: (result: { scripts: Script[] }) => void;
}) {
  const categories = useContentCategories();
  const series = useContentSeries();
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [categoryId, setCategoryId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [newSeriesLabel, setNewSeriesLabel] = useState("");
  const [newSeriesDescription, setNewSeriesDescription] = useState("");
  const [episodeCount, setEpisodeCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableCategories = categories.filter((c) => c.platforms.length === 0 || c.platforms.includes(platform));
  const selectedCategoryId = availableCategories.some((c) => c.id === categoryId) ? categoryId : availableCategories[0]?.id || "";

  async function handleGenerate() {
    if (!selectedCategoryId) return;
    if (!seriesId && !newSeriesLabel.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.generateSeriesFromMaterial({
        productId,
        seriesId: seriesId || undefined,
        newSeries: seriesId ? undefined : { label: newSeriesLabel.trim(), description: newSeriesDescription.trim() || newSeriesLabel.trim() },
        platform,
        contentCategoryId: selectedCategoryId,
        contentType: "text",
        episodeCount,
      });
      onDone(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la génération de la série.");
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={600}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20 }}>Générer une série depuis la matière</div>
          <p style={{ margin: "6px 0 0", color: color.textMuted, fontSize: 14 }}>
            Un seul effort documenté → plusieurs scripts ordonnés, prêts à planifier.
          </p>
        </div>
        <IconActionButton icon={X} variant="neutral" title="Fermer" onClick={onClose} size={32} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.text3, marginBottom: 10 }}>Plateforme</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {KNOWN_PLATFORMS.map(({ key: p }) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              style={{
                border: `1.5px solid ${p === platform ? accent : color.border}`,
                background: p === platform ? accentAlpha(0.07) : color.inputBg,
                borderRadius: 10,
                padding: "8px 12px",
                fontWeight: p === platform ? 600 : 500,
                color: p === platform ? "oklch(0.45 0.2 292)" : color.textMuted,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <PlatformBadge platform={p} size={14} />
              {platformMeta[p].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.text3, marginBottom: 10 }}>Catégorie de contenu</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {availableCategories.map((c) => {
            const meta = resolveCategoryMeta(c);
            const active = c.id === selectedCategoryId;
            return (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                style={{
                  border: `1.5px solid ${active ? meta.base : color.border}`,
                  background: active ? meta.bg : color.inputBg,
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontWeight: active ? 600 : 500,
                  color: active ? meta.fg : color.textMuted,
                  cursor: "pointer",
                }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.text3, marginBottom: 10 }}>Série</label>
        <select
          value={seriesId}
          onChange={(e) => setSeriesId(e.target.value)}
          style={{ width: "100%", border: `1px solid ${color.inputBorder}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", background: color.inputBg, color: color.text, marginBottom: 10 }}
        >
          <option value="">+ Nouvelle série</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {!seriesId && (
          <div style={{ display: "grid", gap: 8 }}>
            <TextField label="Nom de la série" value={newSeriesLabel} onChange={(e) => setNewSeriesLabel(e.target.value)} placeholder="Journal de bord" />
            <TextField label="Description" optional value={newSeriesDescription} onChange={(e) => setNewSeriesDescription(e.target.value)} placeholder="Les coulisses du projet, épisode par épisode" />
          </div>
        )}
      </div>

      <div style={{ marginBottom: 26 }}>
        <TextField
          label="Nombre d'épisodes"
          type="number"
          min={2}
          max={10}
          value={episodeCount}
          onChange={(e) => setEpisodeCount(Math.max(2, Math.min(10, Number(e.target.value))))}
        />
      </div>

      {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <Button
        fullWidth
        onClick={handleGenerate}
        disabled={loading || !selectedCategoryId || (!seriesId && !newSeriesLabel.trim())}
        style={{ padding: 15, fontSize: 16 }}
      >
        {loading ? "Génération en cours..." : `Générer ${episodeCount} scripts`}
      </Button>
    </Modal>
  );
}

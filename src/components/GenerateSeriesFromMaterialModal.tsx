"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import IconActionButton from "@/components/ui/IconActionButton";
import { api, ApiClientError, type ContentSeries, type NarrativeState } from "@/lib/apiClient";
import { color, fontHeading } from "@/lib/design/tokens";
import { useContentSeries } from "@/contexts/SeriesContext";

/**
 * Génération de série depuis la matière (docs/SPEC_MATIERE_EDITEUR.md §3.8, remplacé par
 * docs/SPEC_REDACTEUR_EN_CHEF.md §4.4 — Lot B3) — "un effort documenté → un plan", pas plus plusieurs
 * scripts synchrones : le rédacteur en chef planifie l'arc (NarrativeState, mode feuilleton), la
 * génération réelle des scripts suit ensuite le flux normal (créneau/génération libre), qui pioche
 * dans ce plan beat par beat.
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
  onDone: (result: { series: ContentSeries; state: NarrativeState }) => void;
}) {
  const series = useContentSeries();
  const [seriesId, setSeriesId] = useState("");
  const [newSeriesLabel, setNewSeriesLabel] = useState("");
  const [newSeriesDescription, setNewSeriesDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!seriesId && !newSeriesLabel.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.generateSeriesFromMaterial({
        productId,
        seriesId: seriesId || undefined,
        newSeries: seriesId ? undefined : { label: newSeriesLabel.trim(), description: newSeriesDescription.trim() || newSeriesLabel.trim() },
      });
      onDone(result);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la planification de la série.");
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={520}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20 }}>Générer une série depuis la matière</div>
          <p style={{ margin: "6px 0 0", color: color.textMuted, fontSize: 14 }}>
            Un seul effort documenté → un plan d&apos;épisodes ordonné. La génération des scripts suit ensuite normalement,
            créneau par créneau.
          </p>
        </div>
        <IconActionButton icon={X} variant="neutral" title="Fermer" onClick={onClose} size={32} />
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

      {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <Button fullWidth onClick={handleGenerate} disabled={loading || (!seriesId && !newSeriesLabel.trim())} style={{ padding: 15, fontSize: 16 }}>
        {loading ? "Planification en cours..." : "Planifier cette série"}
      </Button>
    </Modal>
  );
}

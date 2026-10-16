"use client";

import { useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import IconActionButton from "@/components/ui/IconActionButton";
import PlatformLogo from "@/components/calendar/PlatformLogo";
import { api, ApiClientError, type WeekEntry } from "@/lib/apiClient";
import { accent, color, fontHeading } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { useContentSeries } from "@/contexts/SeriesContext";

const chip = (active: boolean): React.CSSProperties => ({
  border: `1.5px solid ${active ? accent : color.border}`,
  background: active ? "oklch(0.55 0.2 292 / 0.08)" : color.inputBg,
  borderRadius: 20,
  padding: "7px 13px",
  fontSize: 13,
  fontWeight: active ? 600 : 500,
  color: active ? "oklch(0.45 0.2 292)" : color.textMuted,
  cursor: "pointer",
  fontFamily: "inherit",
});

/**
 * Édition d'un créneau encore vide : série (qui impose son rôle) ou post libre avec son rôle, ou
 * suppression (docs/SPEC_SERIES_ET_ROLES.md §5.4).
 */
export default function SlotEditorModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: WeekEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const categories = useContentCategories();
  const series = useContentSeries();
  const [categoryId, setCategoryId] = useState(entry.contentCategory.id);
  const [seriesId, setSeriesId] = useState(entry.series?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSeries = series.filter((s) => s.platforms.length === 0 || s.platforms.includes(entry.platform));

  function selectSeries(next: string) {
    setSeriesId(next);
    const role = series.find((s) => s.id === next)?.category?.id;
    if (role) setCategoryId(role);
  }

  async function run(action: () => Promise<unknown>) {
    setSaving(true);
    setError(null);
    try {
      await action();
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "La modification du créneau a échoué.");
      setSaving(false);
    }
  }

  const unchanged = categoryId === entry.contentCategory.id && seriesId === (entry.series?.id ?? "");

  return (
    <Modal open onClose={() => !saving && onClose()} width={420}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <PlatformLogo platform={entry.platform} size={20} />
        <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18 }}>
          Créneau du {new Date(entry.scheduledDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })}
        </span>
      </div>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted }}>Pas encore de post sur ce créneau.</p>

      <div style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 8 }}>Série</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <button type="button" onClick={() => setSeriesId("")} style={chip(seriesId === "")}>
          Post libre
        </button>
        {availableSeries.map((s) => (
          <button key={s.id} type="button" onClick={() => selectSeries(s.id)} style={chip(s.id === seriesId)}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 8 }}>
        Rôle{seriesId && <span style={{ color: color.textFaint, fontWeight: 400 }}> — imposé par la série</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {categories.map((c) => {
          const meta = resolveCategoryMeta(c);
          const active = c.id === categoryId;
          if (seriesId && !active) return null;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => !seriesId && setCategoryId(c.id)}
              disabled={Boolean(seriesId)}
              style={{
                ...chip(active),
                border: `1.5px solid ${active ? meta.base : color.border}`,
                background: active ? meta.bg : color.inputBg,
                color: active ? meta.fg : color.textMuted,
                cursor: seriesId ? "default" : "pointer",
              }}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {error && <p style={{ color: color.danger, fontSize: 13, margin: "0 0 14px" }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconActionButton
          icon={Trash2}
          variant="danger"
          title="Supprimer le créneau"
          onClick={() => run(() => api.deleteCalendarEntry(entry.id))}
          disabled={saving}
        />
        <div style={{ flex: 1 }} />
        <IconActionButton icon={X} variant="neutral" title="Annuler" onClick={onClose} disabled={saving} />
        <IconActionButton
          icon={Check}
          variant="primary"
          title="Enregistrer"
          // Avec une série, le serveur dérive le rôle : on n'envoie que seriesId (§4.2).
          onClick={() =>
            run(() =>
              api.updateCalendarEntry(entry.id, seriesId ? { seriesId } : { contentCategoryId: categoryId, seriesId: null })
            )
          }
          disabled={saving || unchanged}
        />
      </div>
    </Modal>
  );
}

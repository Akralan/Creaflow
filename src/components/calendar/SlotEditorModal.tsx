"use client";

import { useState } from "react";
import Link from "next/link";
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
 * Editing a still-empty slot. A series slot follows its series' rhythm
 * (docs/SPEC_RYTHME_DES_SERIES.md): you can only skip that day, or go and change the
 * rhythm; moving it to another series would be undone at the next recalculation. A post placed by
 * hand outside any series keeps the choice of its role (docs/SPEC_SERIES_ET_ROLES.md §5.4).
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
      setError(err instanceof ApiClientError ? err.message : "Couldn't update the slot.");
      setSaving(false);
    }
  }

  const unchanged = categoryId === entry.contentCategory.id && seriesId === (entry.series?.id ?? "");

  if (entry.series) {
    return (
      <Modal open onClose={() => !saving && onClose()} width={420}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <PlatformLogo platform={entry.platform} size={20} />
          <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18 }}>
            {entry.series.label} · {new Date(entry.scheduledDate).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}
          </span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted, lineHeight: 1.5 }}>
          No post yet. This day comes from the series&apos; rhythm: you can skip it, or{" "}
          <Link href={`/direction?series=${entry.series.id}&edit=1`}>change the rhythm</Link>.
        </p>
        {error && <p style={{ color: color.danger, fontSize: 13, margin: "0 0 14px" }}>{error}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => run(() => api.deleteCalendarEntry(entry.id))}
            disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: color.danger, background: "none", border: "none", cursor: "pointer", padding: "8px 4px" }}
          >
            <Trash2 size={15} strokeWidth={2} />
            {saving ? "…" : "Skip this day"}
          </button>
          <div style={{ flex: 1 }} />
          <IconActionButton icon={X} variant="neutral" title="Close" onClick={onClose} disabled={saving} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={() => !saving && onClose()} width={420}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
        <PlatformLogo platform={entry.platform} size={20} />
        <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18 }}>
          Slot for {new Date(entry.scheduledDate).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}
        </span>
      </div>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted }}>No post in this slot yet.</p>

      <div style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 8 }}>Series</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        <button type="button" onClick={() => setSeriesId("")} style={chip(seriesId === "")}>
          Free post
        </button>
        {availableSeries.map((s) => (
          <button key={s.id} type="button" onClick={() => selectSeries(s.id)} style={chip(s.id === seriesId)}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 8 }}>
        Role{seriesId && <span style={{ color: color.textFaint, fontWeight: 400 }}> — set by the series</span>}
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
          title="Delete the slot"
          onClick={() => run(() => api.deleteCalendarEntry(entry.id))}
          disabled={saving}
        />
        <div style={{ flex: 1 }} />
        <IconActionButton icon={X} variant="neutral" title="Cancel" onClick={onClose} disabled={saving} />
        <IconActionButton
          icon={Check}
          variant="primary"
          title="Save"
          // With a series, the server derives the role: we only send seriesId (§4.2).
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

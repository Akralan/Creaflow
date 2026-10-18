"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import RhythmPicker, { daysTakenBy } from "@/components/RhythmPicker";
import { api, ApiClientError, type ContentSeries, type SeriesSlotChange } from "@/lib/apiClient";
import { suggestDays, type SeriesRhythm } from "@/lib/seriesRhythm";
import { accentAlpha, color, fontHeading } from "@/lib/design/tokens";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";

/**
 * Editing ONE series (docs/SPEC_SERIES_ET_ROLES.md) — opened from the pencil icon of a card on the
 * Direction screen, or for creation from "New series". Replaces the old multi-row
 * SeriesPanel form, which the move to master-detail left without a place.
 *
 * `POST /api/series` archives any series MISSING from the array sent: so we always send back the full
 * active set, with the edited series replaced, added, or removed (= archived) depending on the gesture.
 */
export default function SeriesEditModal({
  open,
  series,
  allSeries,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = creating a new series. */
  series: ContentSeries | null;
  allSeries: ContentSeries[];
  onClose: () => void;
  /** `slotChange`: what saving changed in the calendar for the edited series. */
  onSaved: (series: ContentSeries[], removedId?: string, slotChange?: SeriesSlotChange & { seriesId: string }) => void;
}) {
  const categories = useContentCategories();
  const [label, setLabel] = useState(series?.label ?? "");
  const [description, setDescription] = useState(series?.description ?? "");
  const takenBy = daysTakenBy(allSeries, series?.id);
  // A series without a rhythm (older data) or a new one starts on a Wednesday, replaced as soon as the
  // days the author can publish are known.
  const [rhythm, setRhythm] = useState<SeriesRhythm>(series?.rhythm ?? { days: [3], every: 1, anchor: null });
  // A ref, not state: the profile response, which arrives later, must see a gesture made in the meantime.
  const rhythmTouched = useRef(Boolean(series?.rhythm));
  const [categoryId, setCategoryId] = useState(series?.category?.id ?? "");
  const [platforms] = useState<string[]>(series?.platforms ?? []);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New series: pre-tick the days the author can publish that no other series occupies
  // (docs/SPEC_RYTHME_DES_SERIES.md §4).
  useEffect(() => {
    if (rhythmTouched.current) return;
    let cancelled = false;
    api
      .getProfile()
      .then(({ profile }) => {
        if (cancelled || !profile || rhythmTouched.current) return;
        setRhythm((r) => ({ ...r, days: suggestDays(profile.publishingDays, Object.keys(takenBy).map(Number)) }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Only once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Shape expected by `POST /api/series` — `id` absent = creation. The rhythm of the other
   *  series is omitted: the server leaves it unchanged. */
  type SeriesDraft = {
    id?: string;
    label: string;
    description: string;
    categoryId: string;
    platforms: string[];
    rhythm?: SeriesRhythm;
  };

  function toDraft(s: ContentSeries): SeriesDraft {
    return {
      id: s.id,
      label: s.label,
      description: s.description,
      categoryId: s.category?.id ?? "",
      platforms: s.platforms,
    };
  }

  async function submit(payload: SeriesDraft[], removedId?: string) {
    setSaving(true);
    setError(null);
    try {
      const { series: saved, slotChanges } = await api.saveContentSeries(payload);
      // The edited series: the existing one, or when creating, the one that wasn't there before.
      const before = new Set(allSeries.map((s) => s.id));
      const editedId = series?.id ?? saved.find((s) => !before.has(s.id))?.id;
      const change = editedId ? slotChanges[editedId] : undefined;
      onSaved(saved, removedId, change && editedId ? { ...change, seriesId: editedId } : undefined);
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!label.trim()) {
      setError("Give this series a name.");
      return;
    }
    if (!categoryId) {
      setError("Every series needs a role.");
      return;
    }
    const edited = { id: series?.id, label: label.trim(), description: description.trim() || label.trim(), categoryId, platforms, rhythm };
    const payload = series
      ? allSeries.map((s) => (s.id === series.id ? edited : toDraft(s)))
      : [...allSeries.map(toDraft), edited];
    await submit(payload);
  }

  /** Removing a series = omitting it from the array sent, which archives it server-side (never a
   *  hard delete: the scripts and slots that reference it must stay valid). */
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
        {series ? "Edit series" : "New series"}
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: color.textMuted, lineHeight: 1.5 }}>
        A recurring, named format with its own identity, serving a role in your mix. It publishes on its days:
        its posts land in the calendar as soon as you save.
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 6 }}>
            Series name
          </label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Myth-busting Wednesday" style={fieldStyle} />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 6 }}>
            Series identity
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Angle, tone, structure to follow in every episode"
            rows={2}
            style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.45 }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 6 }}>
            Role
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

        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 6 }}>
            Rhythm <span style={{ fontWeight: 400, color: color.textFaint }}>— the days this series publishes</span>
          </label>
          <RhythmPicker
            value={rhythm}
            takenBy={takenBy}
            onChange={(next) => {
              rhythmTouched.current = true;
              setRhythm(next);
            }}
          />
        </div>

        <p style={{ margin: 0, fontSize: 13, color: color.textFaint }}>
          Every post of this series is written for LinkedIn and for X, with a different text for each.
        </p>
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
            Remove <strong>{series?.label}</strong>? It disappears from Direction and from the upcoming calendar. Scripts
            already generated for this series are kept.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={saving}>
              Cancel
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
              {saving ? "..." : "Remove series"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24 }}>
          {series && (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={saving}
              title="Remove this series"
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
              Remove
            </button>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "..." : "Save"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

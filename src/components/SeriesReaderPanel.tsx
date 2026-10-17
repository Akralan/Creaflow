"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type ContentSeries, type PortraitReader, type SeriesForm, type SeriesPlan } from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";

/**
 * The reader and shape of a series (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4), and the plan that
 * follows from it: the topic's timeline as seen by this reader. One reader per series; changing it
 * rewrites the shape; the shape can be corrected by hand.
 */

const FORM_FIELDS: Array<{ key: "wants" | "episodeShape" | "avoid" | "register" | "signature"; label: string; rows: number }> = [
  { key: "wants", label: "What they come looking for", rows: 2 },
  { key: "episodeShape", label: "What makes a good episode", rows: 4 },
  { key: "avoid", label: "What makes them leave", rows: 2 },
  { key: "register", label: "Length and register", rows: 2 },
  { key: "signature", label: "Signature (what comes back in every episode)", rows: 1 },
];

function formatDate(date: string | null, precision: string): string {
  if (!date || precision === "unknown") return "no date";
  const d = new Date(`${date}T00:00:00.000Z`);
  return precision === "month"
    ? d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function SeriesReaderPanel({ series, onSeriesUpdate }: { series: ContentSeries; onSeriesUpdate: (series: ContentSeries) => void }) {
  const [readers, setReaders] = useState<PortraitReader[]>([]);
  const [plan, setPlan] = useState<SeriesPlan | null>(null);
  const [editing, setEditing] = useState<SeriesForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getSeriesReaders(series.id), api.getSeriesPlan(series.id)])
      .then(([r, p]) => {
        if (cancelled) return;
        setReaders(r.readers);
        setPlan(p.plan);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [series.id, series.readerLabel]);

  async function chooseReader(label: string) {
    if (!label || label === series.readerLabel) return;
    setBusy(true);
    setError(null);
    try {
      const { series: updated } = await api.setSeriesReader(series.id, label);
      if (updated) onSeriesUpdate(updated);
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't change the reader.");
    } finally {
      setBusy(false);
    }
  }

  async function saveForm() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const { series: updated } = await api.saveSeriesForm(series.id, {
        wants: editing.wants,
        episodeShape: editing.episodeShape,
        avoid: editing.avoid,
        register: editing.register,
        signature: editing.signature ?? "",
        words: editing.words,
        jargon: editing.jargon,
      });
      if (updated) onSeriesUpdate(updated);
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  const form = series.form;
  const sectionLabel = { fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" as const, color: color.textFaint };
  const fieldStyle = {
    width: "100%",
    border: `1px solid ${color.inputBorder}`,
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 13,
    fontFamily: "inherit",
    background: color.inputBg,
    color: color.text,
    resize: "vertical" as const,
  };

  const upcoming = plan ? plan.events.filter((e) => !e.told) : [];
  const shown = showAll ? upcoming : upcoming.slice(0, 6);

  return (
    <div style={{ background: accentAlpha(0.04), border: `1px solid ${accentAlpha(0.2)}`, borderRadius: 14, padding: "16px 18px", marginBottom: 14, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ ...sectionLabel, color: "oklch(0.47 0.2 292)" }}>Who we write for</div>
        {readers.length > 0 ? (
          <select
            value={series.readerLabel ?? ""}
            onChange={(e) => chooseReader(e.target.value)}
            disabled={busy}
            style={{ ...fieldStyle, width: "auto", minWidth: 220, resize: "none" }}
          >
            {!series.readerLabel && <option value="">Pick a reader…</option>}
            {readers.map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: 13, color: color.textMuted }}>
            {series.product ? "The topic has no reader portrait yet: build it from the topic." : "Link the series to a topic to pick its reader."}
          </span>
        )}
        {busy && <span style={{ fontSize: 12, color: color.textFaint }}>Writing the shape…</span>}
      </div>
      {series.readerLabel && readers.find((r) => r.label === series.readerLabel) && (
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted, lineHeight: 1.5 }}>{readers.find((r) => r.label === series.readerLabel)?.who}</p>
      )}
      {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}

      {form && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={sectionLabel}>The shape of the series{form.editedByUser ? " · edited" : ""}</div>
            <div style={{ flex: 1 }} />
            {editing ? (
              <>
                <Button variant="secondary" onClick={() => setEditing(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button onClick={saveForm} disabled={busy}>
                  Save
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setEditing({ ...form })}>
                Correct
              </Button>
            )}
          </div>
          {FORM_FIELDS.map((f) => (
            <div key={f.key}>
              <div style={{ fontSize: 12, fontWeight: 600, color: color.textSecondary, marginBottom: 3 }}>{f.label}</div>
              {editing ? (
                <textarea value={editing[f.key]} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} rows={f.rows} style={fieldStyle} />
              ) : (
                <div style={{ fontSize: 13, color: color.text2, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{form[f.key] || (f.key === "signature" ? "None" : "")}</div>
              )}
            </div>
          ))}
          <div style={{ fontSize: 12, color: color.textMuted }}>
            {form.words.length > 0 && (
              <div>
                <span style={{ fontWeight: 600 }}>Their words: </span>
                {form.words.join(", ")}
              </div>
            )}
            {form.jargon.length > 0 && (
              <div>
                <span style={{ fontWeight: 600 }}>To avoid or explain: </span>
                {form.jargon.join(", ")}
              </div>
            )}
          </div>
        </div>
      )}

      {plan && (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={sectionLabel}>
            Upcoming episodes · {upcoming.length}
            {plan.events.length > upcoming.length ? ` (${plan.events.length - upcoming.length} already told)` : ""}
          </div>
          {upcoming.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
              Nothing to tell for this reader: the topic&apos;s timeline is empty, or everything has already been told.
            </p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {shown.map((e) => (
                <li key={e.id} style={{ fontSize: 13, color: color.text2 }}>
                  <span style={{ color: color.textFaint, fontSize: 12 }}>{formatDate(e.date, e.datePrecision)} · </span>
                  {e.title}
                </li>
              ))}
            </ol>
          )}
          {upcoming.length > 6 && (
            <button onClick={() => setShowAll((v) => !v)} style={{ alignSelf: "start", fontSize: 12, color: "oklch(0.5 0.2 292)", border: "none", background: "none", cursor: "pointer", padding: 0 }}>
              {showAll ? "Collapse" : `Show all ${upcoming.length}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

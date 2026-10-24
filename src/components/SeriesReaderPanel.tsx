"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError, type ContentSeries, type PortraitReader, type SeriesPlan } from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";
import { GenerationOrb } from "@/components/GenerationAnimation";

/**
 * The reader and shape of a series (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4), and the plan that
 * follows from it: the topic's timeline as seen by this reader. One reader per series; changing it
 * rewrites the shape; the shape can be corrected by hand.
 */

export default function SeriesReaderPanel({ series, onSeriesUpdate }: { series: ContentSeries; onSeriesUpdate: (series: ContentSeries) => void }) {
  const [readers, setReaders] = useState<PortraitReader[]>([]);
  const [plan, setPlan] = useState<SeriesPlan | null>(null);
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
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't change the reader.");
    } finally {
      setBusy(false);
    }
  }

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

  const upcoming = plan ? plan.events.filter((e) => !e.used) : [];
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
        {busy && <GenerationOrb size={18} />}
      </div>
      {series.readerLabel && readers.find((r) => r.label === series.readerLabel) && (
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted, lineHeight: 1.5 }}>{readers.find((r) => r.label === series.readerLabel)?.who}</p>
      )}
      {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}

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
                  <span style={{ color: color.textFaint, fontSize: 12 }}>{e.date ?? "no date"} · </span>
                  <span style={{ fontFamily: "ui-monospace, monospace" }}>{e.file}:{e.line}</span>
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

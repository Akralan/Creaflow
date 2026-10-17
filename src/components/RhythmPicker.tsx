"use client";

import { accentAlpha, color } from "@/lib/design/tokens";
import { mondayOf, toIsoDate, type SeriesRhythm } from "@/lib/seriesRhythm";

const DAYS = [
  { n: 1, short: "M", name: "Monday" },
  { n: 2, short: "T", name: "Tuesday" },
  { n: 3, short: "W", name: "Wednesday" },
  { n: 4, short: "T", name: "Thursday" },
  { n: 5, short: "F", name: "Friday" },
  { n: 6, short: "S", name: "Saturday" },
  { n: 7, short: "S", name: "Sunday" },
];

const DAY_MS = 86_400_000;

/** Anchor of an every-other-week rhythm: the Monday of this week, or of the next. */
function anchorFor(nextWeek: boolean): string {
  const monday = mondayOf(new Date());
  return toIsoDate(nextWeek ? new Date(monday.getTime() + 7 * DAY_MS) : monday);
}

const pill = (active: boolean): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  color: active ? "oklch(0.48 0.2 292)" : color.textMuted,
  background: active ? accentAlpha(0.12) : color.inputBg,
  border: `1px solid ${active ? "oklch(0.6 0.15 292)" : color.inputBorder}`,
  borderRadius: 20,
  padding: "5px 11px",
  cursor: "pointer",
  fontFamily: "inherit",
});

/**
 * Rhythm of a series (docs/SPEC_RYTHME_DES_SERIES.md §4): 7 days to tick, and "every week"
 * or "every other week". Under each day, the other series already publishing then — an
 * information, not a prohibition: two series can publish on the same day.
 */
export default function RhythmPicker({
  value,
  onChange,
  takenBy = {},
}: {
  value: SeriesRhythm;
  onChange: (rhythm: SeriesRhythm) => void;
  /** ISO day → names of the other series publishing that day. */
  takenBy?: Record<number, string[]>;
}) {
  function toggleDay(day: number) {
    const days = value.days.includes(day) ? value.days.filter((d) => d !== day) : [...value.days, day].sort((a, b) => a - b);
    // At least one day: unticking the last one does nothing.
    if (days.length > 0) onChange({ ...value, days });
  }

  const nextWeek = value.anchor !== null && value.anchor > anchorFor(false);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {DAYS.map((d) => {
          const active = value.days.includes(d.n);
          const others = takenBy[d.n] ?? [];
          return (
            <div key={d.n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 52 }}>
              <button
                type="button"
                aria-label={d.name}
                aria-pressed={active}
                title={d.name}
                onClick={() => toggleDay(d.n)}
                style={{ ...pill(active), width: 38, height: 38, padding: 0, borderRadius: 19, fontSize: 13 }}
              >
                {d.short}
              </button>
              <span
                title={others.join(", ")}
                style={{ fontSize: 10.5, lineHeight: 1.2, color: color.textFaint, textAlign: "center", minHeight: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 52 }}
              >
                {others.length > 0 ? others.join(", ") : ""}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={() => onChange({ ...value, every: 1, anchor: null })} style={pill(value.every === 1)}>
          Every week
        </button>
        <button type="button" onClick={() => onChange({ ...value, every: 2, anchor: value.anchor ?? anchorFor(false) })} style={pill(value.every === 2)}>
          Every other week
        </button>
      </div>
      {value.every === 2 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" onClick={() => onChange({ ...value, anchor: anchorFor(false) })} style={pill(!nextWeek)}>
            Starting this week
          </button>
          <button type="button" onClick={() => onChange({ ...value, anchor: anchorFor(true) })} style={pill(nextWeek)}>
            Starting next week
          </button>
        </div>
      )}
    </div>
  );
}

/** Day → names of the series publishing then, excluding the series being edited. */
export function daysTakenBy(series: Array<{ id: string; label: string; rhythm: SeriesRhythm | null }>, exceptId?: string): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  for (const s of series) {
    if (s.id === exceptId || !s.rhythm) continue;
    for (const d of s.rhythm.days) (result[d] ??= []).push(s.label);
  }
  return result;
}

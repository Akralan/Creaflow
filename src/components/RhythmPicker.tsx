"use client";

import { accentAlpha, color } from "@/lib/design/tokens";
import { mondayOf, toIsoDate, type SeriesRhythm } from "@/lib/seriesRhythm";

const DAYS = [
  { n: 1, short: "L", name: "lundi" },
  { n: 2, short: "M", name: "mardi" },
  { n: 3, short: "M", name: "mercredi" },
  { n: 4, short: "J", name: "jeudi" },
  { n: 5, short: "V", name: "vendredi" },
  { n: 6, short: "S", name: "samedi" },
  { n: 7, short: "D", name: "dimanche" },
];

const DAY_MS = 86_400_000;

/** Ancre d'une semaine sur deux : le lundi de cette semaine, ou de la suivante. */
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
 * Rythme d'une série (docs/SPEC_RYTHME_DES_SERIES.md §4) : 7 jours à cocher, et « chaque semaine »
 * ou « une semaine sur deux ». Sous chaque jour, les autres séries qui y publient déjà — une
 * information, pas une interdiction : deux séries peuvent publier le même jour.
 */
export default function RhythmPicker({
  value,
  onChange,
  takenBy = {},
}: {
  value: SeriesRhythm;
  onChange: (rhythm: SeriesRhythm) => void;
  /** Jour ISO → noms des autres séries qui publient ce jour-là. */
  takenBy?: Record<number, string[]>;
}) {
  function toggleDay(day: number) {
    const days = value.days.includes(day) ? value.days.filter((d) => d !== day) : [...value.days, day].sort((a, b) => a - b);
    // Au moins un jour : décocher le dernier ne fait rien.
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
          Chaque semaine
        </button>
        <button type="button" onClick={() => onChange({ ...value, every: 2, anchor: value.anchor ?? anchorFor(false) })} style={pill(value.every === 2)}>
          Une semaine sur deux
        </button>
      </div>
      {value.every === 2 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" onClick={() => onChange({ ...value, anchor: anchorFor(false) })} style={pill(!nextWeek)}>
            À partir de cette semaine
          </button>
          <button type="button" onClick={() => onChange({ ...value, anchor: anchorFor(true) })} style={pill(nextWeek)}>
            À partir de la semaine prochaine
          </button>
        </div>
      )}
    </div>
  );
}

/** Jour → noms des séries qui y publient, sans la série en cours d'édition. */
export function daysTakenBy(series: Array<{ id: string; label: string; rhythm: SeriesRhythm | null }>, exceptId?: string): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  for (const s of series) {
    if (s.id === exceptId || !s.rhythm) continue;
    for (const d of s.rhythm.days) (result[d] ??= []).push(s.label);
  }
  return result;
}

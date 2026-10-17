"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Button from "@/components/ui/Button";
import type { ContentSeries } from "@/lib/apiClient";
import { accent, accentAlpha, color, fontHeading } from "@/lib/design/tokens";

/**
 * Arrivée sur Direction après l'onboarding : les séries proposées côte à côte, toutes cochées. On
 * décoche celles qu'on ne veut pas, on valide — les jours de publication sont alors répartis entre
 * les séries gardées (docs/SPEC_RYTHME_DES_SERIES.md §5), ajustables ensuite dans Direction.
 */
export default function SeriesSelection({
  series,
  busy,
  onConfirm,
}: {
  series: ContentSeries[];
  busy: boolean;
  onConfirm: (keptIds: string[]) => void;
}) {
  const [kept, setKept] = useState<string[]>(() => series.map((s) => s.id));

  function toggle(id: string) {
    setKept((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
          marginBottom: 22,
        }}
      >
        {series.map((s) => {
          const on = kept.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s.id)}
              disabled={busy}
              style={{
                position: "relative",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "16px 16px 18px",
                borderRadius: 14,
                border: `${on ? 1.5 : 1}px solid ${on ? accent : color.border}`,
                background: on ? color.cardBg : color.chipBg,
                boxShadow: on ? `0 0 0 3px ${accentAlpha(0.08)}` : "none",
                opacity: on ? 1 : 0.6,
                cursor: busy ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "opacity .2s ease, border-color .2s ease",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  display: "grid",
                  placeItems: "center",
                  background: on ? accent : color.cardBg,
                  border: `1px solid ${on ? accent : color.inputBorder}`,
                  color: "#fff",
                }}
              >
                {on && <Check size={14} strokeWidth={3} />}
              </span>
              <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 16, color: color.text, paddingRight: 28 }}>
                {s.label}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: color.textMuted }}>
                {s.category?.label ?? ""}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: color.text2 }}>{s.description}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Button onClick={() => onConfirm(kept)} disabled={busy || kept.length === 0}>
          {busy ? "On planifie tes premiers posts…" : `Valider ${kept.length} série${kept.length > 1 ? "s" : ""}`}
        </Button>
        <span style={{ fontSize: 13, color: color.textMuted }}>
          {kept.length === 0
            ? "Garde au moins une série."
            : "On planifie la série principale et on remplit ton calendrier dans la foulée."}
        </span>
      </div>
    </div>
  );
}

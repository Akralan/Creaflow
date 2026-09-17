"use client";

import type { VisualFormat, VisualFormatFields } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";
import { DEFAULT_DURATION_MS, DEFAULT_SLIDES, MAX_DURATION_MS, MAX_SLIDES, MIN_DURATION_MS, MIN_SLIDES } from "@/lib/visualDesign/visualFormat";

const OPTIONS: Array<{ key: VisualFormat; label: string; hint: string }> = [
  { key: "single", label: "Image", hint: "une seule image" },
  { key: "carousel", label: "Carrousel", hint: "plusieurs slides" },
  { key: "animation", label: "Animation", hint: "texte animé, 5 à 15 s" },
];

/**
 * Choix du format d'un post visuel à la génération (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §2) :
 * image, carrousel de N, animation de D secondes. Affiché seulement quand le type est « Visuel ».
 */
export default function VisualFormatPicker({
  value,
  onChange,
  compact = false,
}: {
  value: VisualFormatFields;
  onChange: (next: VisualFormatFields) => void;
  compact?: boolean;
}) {
  const format = value.visualFormat ?? "single";
  const slideCount = value.slideCount ?? DEFAULT_SLIDES;
  const seconds = Math.round((value.durationMs ?? DEFAULT_DURATION_MS) / 1000);

  function pick(next: VisualFormat) {
    if (next === "carousel") onChange({ visualFormat: next, slideCount });
    else if (next === "animation") onChange({ visualFormat: next, durationMs: seconds * 1000 });
    else onChange({ visualFormat: next });
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: compact ? 13 : 14, fontWeight: 600, color: color.text3, marginBottom: compact ? 6 : 12 }}>
        Format du visuel
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
        {OPTIONS.map((o) => {
          const active = o.key === format;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => pick(o.key)}
              style={{
                flex: "1 1 120px",
                border: `1.5px solid ${active ? accent : color.border}`,
                background: active ? accentAlpha(0.07) : color.inputBg,
                borderRadius: 12,
                padding: compact ? "10px 12px" : 14,
                textAlign: "center",
                fontWeight: active ? 600 : 500,
                color: active ? "oklch(0.45 0.2 292)" : color.textMuted,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div>{o.label}</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: color.textFaint, marginTop: 2 }}>{o.hint}</div>
            </button>
          );
        })}
      </div>
      {format === "carousel" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 13, color: color.textMuted }}>
          <span>Nombre de slides</span>
          <input
            type="number"
            min={MIN_SLIDES}
            max={MAX_SLIDES}
            value={slideCount}
            onChange={(e) => onChange({ visualFormat: "carousel", slideCount: Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Number(e.target.value) || MIN_SLIDES)) })}
            style={numberInput}
          />
        </div>
      )}
      {format === "animation" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 13, color: color.textMuted }}>
          <span>Durée</span>
          <input
            type="number"
            min={MIN_DURATION_MS / 1000}
            max={MAX_DURATION_MS / 1000}
            value={seconds}
            onChange={(e) =>
              onChange({
                visualFormat: "animation",
                durationMs: Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, (Number(e.target.value) || MIN_DURATION_MS / 1000) * 1000)),
              })
            }
            style={numberInput}
          />
          <span>secondes</span>
        </div>
      )}
    </div>
  );
}

const numberInput: React.CSSProperties = {
  width: 72,
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "inherit",
  background: color.cardBg,
};

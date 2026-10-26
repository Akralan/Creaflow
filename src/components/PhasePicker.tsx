import { accent, accentAlpha, color } from "@/lib/design/tokens";
import { PHASE_CHOICES, phaseChoice, phaseOfChoice, type Phase } from "@/lib/phases";

/** Où en est le projet (src/lib/phases.ts) : quatre choix, et bêta / lancement quand il s'ouvre. */
export default function PhasePicker({ value, onChange }: { value: Phase; onChange: (phase: Phase) => void }) {
  const chip = (active: boolean): React.CSSProperties => ({
    padding: "7px 14px",
    border: `1.5px solid ${active ? accent : color.inputBorder}`,
    background: active ? accentAlpha(0.08) : color.inputBg,
    color: active ? "oklch(0.45 0.2 292)" : color.textMuted,
    borderRadius: 999,
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: active ? 600 : 500,
    cursor: "pointer",
  });
  const current = phaseChoice(value);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }} role="group" aria-label="Where your project is">
        {PHASE_CHOICES.map(({ choice, label, hint }) => (
          <button key={choice} type="button" title={hint} aria-pressed={current === choice} onClick={() => onChange(phaseOfChoice(choice, value))} style={chip(current === choice)}>
            {label}
          </button>
        ))}
      </div>
      {current === "open" && (
        <div style={{ display: "flex", gap: 8 }} role="group" aria-label="Beta or launch">
          {(["beta", "launch"] as const).map((p) => (
            <button key={p} type="button" aria-pressed={value === p} onClick={() => onChange(p)} style={chip(value === p)}>
              {p === "beta" ? "Beta" : "Launch"}
            </button>
          ))}
        </div>
      )}
      <span style={{ fontSize: 12, color: color.textMuted }}>{PHASE_CHOICES.find((c) => c.choice === current)?.hint}</span>
    </div>
  );
}

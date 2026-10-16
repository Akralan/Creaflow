import { accent, accentAlpha, color } from "@/lib/design/tokens";

/** Jours ISO, lundi = 1 … dimanche = 7 (docs/SPEC_ONBOARDING_MVP.md §3). */
const DAYS: Array<{ iso: number; short: string; label: string }> = [
  { iso: 1, short: "L", label: "Lundi" },
  { iso: 2, short: "M", label: "Mardi" },
  { iso: 3, short: "M", label: "Mercredi" },
  { iso: 4, short: "J", label: "Jeudi" },
  { iso: 5, short: "V", label: "Vendredi" },
  { iso: 6, short: "S", label: "Samedi" },
  { iso: 7, short: "D", label: "Dimanche" },
];

/** Une case cochée = un post ce jour-là. Le dernier jour coché ne se décoche pas : il en faut au moins un. */
export default function PublishingDaysPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  function toggle(iso: number) {
    if (value.includes(iso)) {
      if (value.length <= 1) return;
      onChange(value.filter((d) => d !== iso));
    } else {
      onChange([...value, iso].sort((a, b) => a - b));
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {DAYS.map((day) => {
        const active = value.includes(day.iso);
        const locked = active && value.length <= 1;
        return (
          <button
            key={day.iso}
            type="button"
            onClick={() => toggle(day.iso)}
            aria-pressed={active}
            aria-label={day.label}
            title={locked ? `${day.label} — il faut au moins un jour de publication` : day.label}
            style={{
              width: 42,
              height: 42,
              border: `1.5px solid ${active ? accent : color.inputBorder}`,
              background: active ? accentAlpha(0.08) : color.inputBg,
              color: active ? "oklch(0.45 0.2 292)" : color.textMuted,
              borderRadius: "50%",
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              cursor: locked ? "not-allowed" : "pointer",
            }}
          >
            {day.short}
          </button>
        );
      })}
    </div>
  );
}

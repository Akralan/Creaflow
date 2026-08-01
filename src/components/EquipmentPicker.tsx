import { accent, accentAlpha, color } from "@/lib/design/tokens";

export const EQUIPMENT_OPTIONS = ["Smartphone", "Trépied", "Éclairage", "Micro"];

export default function EquipmentPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(item: string) {
    onChange(value.includes(item) ? value.filter((e) => e !== item) : [...value, item]);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {EQUIPMENT_OPTIONS.map((item) => {
        const active = value.includes(item);
        return (
          <button
            key={item}
            onClick={() => toggle(item)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: `1.5px solid ${active ? accent : color.inputBorder}`,
              background: active ? accentAlpha(0.08) : color.inputBg,
              color: active ? "oklch(0.45 0.2 292)" : color.textMuted,
              borderRadius: 30,
              padding: "9px 16px",
              fontSize: 14,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
            }}
          >
            {active ? "✓ " : ""}
            {item}
          </button>
        );
      })}
    </div>
  );
}

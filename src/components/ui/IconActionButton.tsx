"use client";

import type { LucideIcon } from "lucide-react";
import { accent, color } from "@/lib/design/tokens";

export default function IconActionButton({
  icon: Icon,
  onClick,
  disabled,
  variant,
  title,
  size = 40,
}: {
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant: "danger" | "neutral" | "primary";
  title: string;
  size?: number;
}) {
  const variantStyle: React.CSSProperties =
    variant === "danger"
      ? { background: "oklch(0.62 0.15 25 / 0.1)", color: color.danger }
      : variant === "primary"
        ? { background: disabled ? color.textFaint : accent, color: "#fff" }
        : { background: color.inputBg, color: color.textMuted, border: `1px solid ${color.inputBorder}` };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: size,
        height: size,
        borderRadius: size >= 36 ? 11 : 8,
        border: "none",
        display: "grid",
        placeItems: "center",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
        ...variantStyle,
      }}
    >
      <Icon size={size >= 36 ? 18 : 14} strokeWidth={2} />
    </button>
  );
}

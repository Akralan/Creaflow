"use client";

import type { ButtonHTMLAttributes } from "react";
import { accent, accentHover, color } from "@/lib/design/tokens";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const base: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 15,
  fontWeight: 600,
  borderRadius: 11,
  padding: "12px 22px",
  cursor: "pointer",
  border: "none",
  transition: "opacity .15s",
};

export default function Button({ variant = "primary", fullWidth, style, disabled, ...props }: ButtonProps) {
  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? { background: disabled ? color.textFaint : accent, color: "#fff" }
      : variant === "secondary"
        ? {
            background: color.cardBg,
            color: color.textSecondary,
            border: `1px solid ${color.inputBorder}`,
          }
        : { background: "none", color: color.textMuted, padding: "8px 4px" };

  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...base,
        ...variantStyle,
        width: fullWidth ? "100%" : undefined,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (variant === "primary" && !disabled) e.currentTarget.style.background = accentHover;
      }}
      onMouseLeave={(e) => {
        if (variant === "primary" && !disabled) e.currentTarget.style.background = accent;
      }}
    />
  );
}

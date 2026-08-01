import type { HTMLAttributes } from "react";
import { color } from "@/lib/design/tokens";

export default function Card({ style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      style={{
        background: color.cardBg,
        border: `1px solid ${color.border}`,
        borderRadius: 18,
        padding: 24,
        ...style,
      }}
    />
  );
}

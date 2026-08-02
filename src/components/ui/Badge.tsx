"use client";

import { fontHeading, genericPlatformMeta, platformMeta, type Platform } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";

export function PlatformBadge({ platform, size = 20 }: { platform: Platform; size?: number }) {
  const meta = platformMeta[platform] ?? { ...genericPlatformMeta, badge: platform.slice(0, 2).toUpperCase() };
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size <= 20 ? 5 : 6,
        background: meta.badgeBg,
        color: "#fff",
        fontWeight: 700,
        fontSize: size <= 20 ? 9 : 10,
        display: "grid",
        placeItems: "center",
        fontFamily: fontHeading,
        flexShrink: 0,
      }}
    >
      {meta.badge}
    </span>
  );
}

export function CategoryPill({ category }: { category?: { id: string; label: string } | null }) {
  const meta = resolveCategoryMeta(category);
  return (
    <span
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: meta.fg,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: 20,
        padding: "6px 12px",
      }}
    >
      {meta.label}
    </span>
  );
}

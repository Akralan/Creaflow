import type { HTMLAttributes } from "react";
import { PlatformBadge } from "@/components/ui/Badge";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import type { ContentCategorySummary } from "@/lib/apiClient";
import type { Platform } from "@/lib/design/tokens";

export interface EntryPreviewData {
  platform: Platform;
  contentCategory: ContentCategorySummary;
  series?: ContentCategorySummary | null;
  title?: string | null;
}

interface EntryCardProps extends HTMLAttributes<HTMLDivElement> {
  data: EntryPreviewData;
}

export default function EntryCard({ data, children, style, ...rest }: EntryCardProps) {
  const cat = resolveCategoryMeta(data.contentCategory);
  return (
    <div
      {...rest}
      style={{
        borderRadius: 8,
        background: cat.bg,
        border: `1px solid ${cat.border}`,
        padding: 6,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <PlatformBadge platform={data.platform} size={17} />
        <span style={{ fontSize: 10, fontWeight: 700, color: cat.fg, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          {cat.label}
        </span>
      </div>
      {data.series && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "oklch(0.47 0.2 292)",
            background: "oklch(0.55 0.2 292 / 0.12)",
            borderRadius: 20,
            padding: "2px 7px",
            alignSelf: "flex-start",
          }}
        >
          ◈ {data.series.label}
        </span>
      )}
      {data.title && <div style={{ fontSize: 11, lineHeight: 1.2, color: "#2a2521", fontWeight: 500 }}>{data.title}</div>}
      {children}
    </div>
  );
}

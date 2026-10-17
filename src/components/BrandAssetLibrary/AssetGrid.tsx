"use client";

import { color } from "@/lib/design/tokens";
import type { BrandAsset } from "@/lib/apiClient";

const STATUS_LABEL: Record<BrandAsset["status"], string> = {
  pending: "Analyzing…",
  ready: "",
  unreachable: "Reconnection needed",
};

/** Checkerboard behind a cutout, to show the transparency. */
const CHECKER = "repeating-conic-gradient(#e7e0d4 0% 25%, #f7f3ec 0% 50%) 0 0 / 16px 16px";

export default function AssetGrid({
  assets,
  selectedIds,
  onToggle,
  onDelete,
  cutout,
  maxSelected,
}: {
  assets: BrandAsset[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  /** Cutout from the card (docs/SPEC_COMPOSITION_VISUELLE.md §6 "Library"); absent = no action. */
  cutout?: { available: boolean; busyId: string | null; onCutout: (id: string) => void };
  /** Beyond that, unselected cards become inactive. */
  maxSelected?: number;
}) {
  if (assets.length === 0) {
    return (
      <p style={{ fontSize: 13, color: color.textMuted, padding: "24px 0", textAlign: "center" }}>
        No photos yet — import images of your brand above.
      </p>
    );
  }
  const full = maxSelected !== undefined && selectedIds.length >= maxSelected;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
      {assets.map((asset) => {
        const selected = selectedIds.includes(asset.id);
        const selectable = asset.status === "ready" && (selected || !full);
        const showCutout = Boolean(asset.cutoutUrl);
        const cutoutBusy = cutout?.busyId === asset.id;
        return (
          <div
            key={asset.id}
            onClick={() => selectable && onToggle(asset.id)}
            style={{
              position: "relative",
              aspectRatio: "1 / 1",
              borderRadius: 10,
              overflow: "hidden",
              border: selected ? "2px solid oklch(0.55 0.2 292)" : `1px solid ${color.border}`,
              cursor: selectable ? "pointer" : "default",
              opacity: asset.status === "ready" && !selectable ? 0.45 : 1,
              background: asset.status === "unreachable" ? "oklch(0.62 0.15 25 / 0.08)" : showCutout ? CHECKER : color.trackBg,
            }}
          >
            {asset.cutoutUrl || asset.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.cutoutUrl ?? asset.thumbnailUrl ?? ""}
                alt={asset.aiDescription || ""}
                style={{ width: "100%", height: "100%", objectFit: showCutout ? "contain" : "cover", opacity: asset.status === "ready" ? 1 : 0.5 }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "repeating-linear-gradient(45deg,#efe9df,#efe9df 6px,#e7e0d4 6px,#e7e0d4 12px)",
                }}
              />
            )}

            {STATUS_LABEL[asset.status] && (
              <div
                style={{
                  position: "absolute",
                  inset: "auto 0 0 0",
                  fontSize: 10,
                  fontWeight: 600,
                  textAlign: "center",
                  padding: "3px 4px",
                  color: asset.status === "unreachable" ? "#fff" : color.text,
                  background: asset.status === "unreachable" ? color.danger : "rgba(255,255,255,0.85)",
                }}
              >
                {STATUS_LABEL[asset.status]}
              </div>
            )}

            {cutout && asset.status === "ready" && !showCutout && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (cutout.available && !cutoutBusy) cutout.onCutout(asset.id);
                }}
                disabled={!cutout.available || cutoutBusy}
                title={cutout.available ? "Cut out the subject (transparent background)" : "Cutout not configured on this server"}
                style={{
                  position: "absolute",
                  inset: "auto 6px 6px auto",
                  border: "none",
                  borderRadius: 999,
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  background: "rgba(28,25,23,0.7)",
                  color: "#fff",
                  cursor: cutout.available ? "pointer" : "default",
                  opacity: cutout.available ? 1 : 0.5,
                }}
              >
                {cutoutBusy ? "…" : "Cut out"}
              </button>
            )}
            {showCutout && (
              <div style={{ position: "absolute", inset: "6px auto auto 30px", fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 999, background: "rgba(28,25,23,0.7)", color: "#fff" }}>
                cut out
              </div>
            )}

            {selected && (
              <div
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "oklch(0.55 0.2 292)",
                  color: "#fff",
                  fontSize: 12,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                ✓
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(asset.id);
              }}
              title="Remove from library"
              style={{
                position: "absolute",
                top: 6,
                left: 6,
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "none",
                background: "rgba(28,25,23,0.55)",
                color: "#fff",
                fontSize: 11,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

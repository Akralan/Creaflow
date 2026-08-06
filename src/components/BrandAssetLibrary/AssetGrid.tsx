"use client";

import { color } from "@/lib/design/tokens";
import type { BrandAsset } from "@/lib/apiClient";

const STATUS_LABEL: Record<BrandAsset["status"], string> = {
  pending: "Analyse en cours…",
  ready: "",
  unreachable: "Reconnexion nécessaire",
};

export default function AssetGrid({
  assets,
  selectedIds,
  onToggle,
  onDelete,
}: {
  assets: BrandAsset[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (assets.length === 0) {
    return (
      <p style={{ fontSize: 13, color: color.textMuted, padding: "24px 0", textAlign: "center" }}>
        Aucune photo pour l&apos;instant — importe des images de ta marque ci-dessus.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
      {assets.map((asset) => {
        const selected = selectedIds.includes(asset.id);
        const selectable = asset.status === "ready";
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
              background: asset.status === "unreachable" ? "oklch(0.62 0.15 25 / 0.08)" : color.trackBg,
            }}
          >
            {asset.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.thumbnailUrl}
                alt={asset.aiDescription || ""}
                style={{ width: "100%", height: "100%", objectFit: "cover", opacity: asset.status === "ready" ? 1 : 0.5 }}
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
              title="Retirer de la bibliothèque"
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

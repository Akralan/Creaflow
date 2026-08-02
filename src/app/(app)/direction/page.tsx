"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { PlatformBadge } from "@/components/ui/Badge";
import { heading1Style } from "@/components/ui/TextField";
import SeriesPanel from "@/components/SeriesPanel";
import { api, ApiClientError, type Script } from "@/lib/apiClient";
import { color, statusMeta } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { useContentSeries } from "@/contexts/SeriesContext";

function SeriesLibrary() {
  const router = useRouter();
  const series = useContentSeries();
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(seriesId: string) {
    if (openSeriesId === seriesId) {
      setOpenSeriesId(null);
      return;
    }
    setOpenSeriesId(seriesId);
    setLoading(true);
    setError(null);
    try {
      const { scripts } = await api.getScripts({ seriesId });
      setScripts(scripts);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  if (series.length === 0) return null;

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 14 }}>Bibliothèque</div>
      <div style={{ display: "grid", gap: 12 }}>
        {series.map((s) => {
          const open = openSeriesId === s.id;
          return (
            <Card key={s.id} style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => toggle(s.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: 16,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {s.categories.map((c) => {
                      const meta = resolveCategoryMeta(c);
                      return (
                        <span
                          key={c.id}
                          style={{ fontSize: 11, fontWeight: 600, color: meta.fg, background: meta.bg, borderRadius: 20, padding: "3px 9px" }}
                        >
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: color.textMuted }}>{s.weight}%</span>
              </button>

              {open && (
                <div style={{ borderTop: `1px solid ${color.dividerAlt}`, padding: 16 }}>
                  {loading ? (
                    <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>Chargement...</p>
                  ) : error ? (
                    <p style={{ fontSize: 13, color: color.danger, margin: 0 }}>{error}</p>
                  ) : scripts.length === 0 ? (
                    <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>Aucun script généré pour cette série pour l&apos;instant.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {scripts.map((script) => {
                        const status = statusMeta[script.status];
                        return (
                          <div
                            key={script.id}
                            onClick={() => router.push(`/scripts/${script.id}`)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 10px",
                              borderRadius: 8,
                              background: color.inputBg,
                              cursor: "pointer",
                            }}
                          >
                            <PlatformBadge platform={script.platform} size={18} />
                            <span style={{ flex: 1, fontSize: 13, color: color.text2 }}>{script.title}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: status.fg, background: status.bg, borderRadius: 20, padding: "2px 8px" }}>
                              {status.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function DirectionPage() {
  return (
    <div style={{ padding: "32px 36px", maxWidth: 820 }}>
      <h1 style={heading1Style}>Direction</h1>
      <p style={{ margin: "6px 0 24px", color: color.textMuted, fontSize: 15 }}>
        Les formats récurrents qui donnent une identité à ton contenu, et tout ce qui a déjà été généré pour chacun.
      </p>
      <SeriesPanel />
      <SeriesLibrary />
    </div>
  );
}

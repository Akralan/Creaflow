"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { PlatformBadge } from "@/components/ui/Badge";
import { heading1Style } from "@/components/ui/TextField";
import SeriesPanel from "@/components/SeriesPanel";
import NarrativeArcSection from "@/components/NarrativeArcSection";
import { api, ApiClientError, type ContentSeries, type Script } from "@/lib/apiClient";
import { color, statusMeta } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";

function SeriesLibrary({
  series,
  onSeriesUpdate,
}: {
  series: ContentSeries[];
  onSeriesUpdate: (updated: ContentSeries) => void;
}) {
  const router = useRouter();
  const [openSeriesIds, setOpenSeriesIds] = useState<Set<string>>(new Set());
  const [scriptsBySeriesId, setScriptsBySeriesId] = useState<Record<string, Script[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [errorsBySeriesId, setErrorsBySeriesId] = useState<Record<string, string>>({});

  // Ouvertes par défaut : dès qu'une série apparaît, on l'affiche déployée et on charge ses scripts.
  useEffect(() => {
    const newIds = series.map((s) => s.id).filter((id) => !openSeriesIds.has(id));
    if (newIds.length === 0) return;
    setOpenSeriesIds((prev) => new Set([...prev, ...newIds]));
    newIds.forEach((id) => loadScripts(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  async function loadScripts(seriesId: string) {
    setLoadingIds((prev) => new Set(prev).add(seriesId));
    setErrorsBySeriesId((prev) => {
      const next = { ...prev };
      delete next[seriesId];
      return next;
    });
    try {
      const { scripts } = await api.getScripts({ seriesId });
      setScriptsBySeriesId((prev) => ({ ...prev, [seriesId]: scripts }));
    } catch (err) {
      setErrorsBySeriesId((prev) => ({
        ...prev,
        [seriesId]: err instanceof ApiClientError ? err.message : "Erreur de chargement.",
      }));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(seriesId);
        return next;
      });
    }
  }

  function toggle(seriesId: string) {
    setOpenSeriesIds((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) {
        next.delete(seriesId);
      } else {
        next.add(seriesId);
        if (!(seriesId in scriptsBySeriesId)) loadScripts(seriesId);
      }
      return next;
    });
  }

  if (series.length === 0) return null;

  return (
    <div>
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 14 }}>Bibliothèque</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, alignItems: "start" }}>
        {series.map((s) => {
          const open = openSeriesIds.has(s.id);
          const loading = loadingIds.has(s.id);
          const error = errorsBySeriesId[s.id];
          const scripts = scriptsBySeriesId[s.id] ?? [];
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
                  <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${color.dividerAlt}` }}>
                    <NarrativeArcSection series={s} onSeriesUpdate={onSeriesUpdate} />
                  </div>
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
  const [series, setSeries] = useState<ContentSeries[]>([]);

  return (
    <div style={{ padding: "32px 36px" }}>
      <h1 style={heading1Style}>Direction</h1>
      <p style={{ margin: "6px 0 24px", color: color.textMuted, fontSize: 15 }}>
        Les formats récurrents qui donnent une identité à ton contenu, et tout ce qui a déjà été généré pour chacun.
      </p>
      <SeriesPanel onSeriesChange={setSeries} />
      <div style={{ marginTop: 28 }}>
        <SeriesLibrary
          series={series}
          onSeriesUpdate={(updated) => setSeries((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
        />
      </div>
    </div>
  );
}

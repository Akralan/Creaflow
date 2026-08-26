"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, SquarePen } from "lucide-react";
import { heading1Style } from "@/components/ui/TextField";
import EditorialMixStrip from "@/components/EditorialMixStrip";
import SeriesEditModal from "@/components/SeriesEditModal";
import SeriesDetail from "@/components/SeriesDetail";
import { api, ApiClientError, type ContentSeries } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";

const MODE_META: Record<ContentSeries["mode"], string> = {
  feuilleton: "Feuilleton",
  rendez_vous: "Rendez-vous",
};

/** Compteurs d'épisodes lus depuis le plan (aucun appel supplémentaire) — une série sans état
 *  narratif n'en a aucun, sa carte se rabat sur une ligne descriptive. */
function beatCounts(series: ContentSeries) {
  const beats = series.narrativeState?.beats ?? [];
  const live = beats.filter((b) => b.status !== "skipped");
  return {
    total: live.length,
    published: live.filter((b) => b.status === "published").length,
    drafted: live.filter((b) => b.status === "drafted").length,
  };
}

function SeriesCard({
  series,
  selected,
  onSelect,
  onEdit,
}: {
  series: ContentSeries;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const meta = resolveCategoryMeta(series.category);
  const counts = beatCounts(series);
  const stale = series.narrativeState?.isStale ?? false;
  const contract = series.narrativeState?.formatContract;

  return (
    <div
      onClick={onSelect}
      style={{
        background: color.cardBg,
        border: `${selected ? 1.5 : 1}px solid ${selected ? "oklch(0.6 0.15 292)" : color.border}`,
        boxShadow: selected ? `0 0 0 3px ${accentAlpha(0.08)}` : "none",
        borderRadius: 14,
        padding: 16,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: selected ? color.text : color.text2, minWidth: 0 }}>{series.label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: color.textMuted }}>{series.weight}%</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Modifier cette série"
            aria-label="Modifier cette série"
            style={{
              display: "grid",
              placeItems: "center",
              width: 26,
              height: 26,
              borderRadius: 8,
              border: "none",
              background: "none",
              color: color.textFaint,
              cursor: "pointer",
            }}
          >
            <SquarePen size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: counts.total > 0 ? 12 : 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: series.mode === "feuilleton" ? "oklch(0.47 0.2 292)" : "oklch(0.45 0.14 250)",
            background: series.mode === "feuilleton" ? accentAlpha(0.1) : "oklch(0.62 0.12 250 / 0.14)",
            borderRadius: 20,
            padding: "3px 9px",
          }}
        >
          {MODE_META[series.mode]}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: meta.fg, background: meta.bg, borderRadius: 20, padding: "3px 9px" }}>
          {meta.label}
        </span>
        {stale && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "oklch(0.55 0.18 60)",
              background: "oklch(0.62 0.13 60 / 0.16)",
              borderRadius: 20,
              padding: "3px 9px",
            }}
          >
            ● Matière non planifiée
          </span>
        )}
      </div>

      {counts.total > 0 ? (
        <>
          <div style={{ height: 6, borderRadius: 20, background: color.trackBg, overflow: "hidden", marginBottom: 7 }}>
            <div
              style={{
                height: "100%",
                width: `${Math.round((counts.published / counts.total) * 100)}%`,
                borderRadius: 20,
                background: accent,
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: color.textMuted }}>
            {counts.total} épisode{counts.total > 1 ? "s" : ""} planifié{counts.total > 1 ? "s" : ""} · {counts.published} publié
            {counts.published > 1 ? "s" : ""} · {counts.drafted} brouillon{counts.drafted > 1 ? "s" : ""}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: color.textMuted }}>
          {series.mode === "rendez_vous"
            ? contract
              ? `Épisodes autonomes · contrat : ${contract}`
              : "Épisodes autonomes"
            : "Pas encore de plan"}
        </div>
      )}
    </div>
  );
}

export default function DirectionPage() {
  const [series, setSeries] = useState<ContentSeries[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ series: ContentSeries | null } | null>(null);
  // 0 série est un résultat légitime de l'IA — ce flag évite de relancer un appel LLM à chaque montage.
  const hasAutoGenerated = useRef(false);

  function apply(next: ContentSeries[], removedId?: string) {
    setSeries(next);
    setSelectedId((current) => {
      if (current && current !== removedId && next.some((s) => s.id === current)) return current;
      return next[0]?.id ?? null;
    });
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const { series: generated } = await api.generateContentSeries();
      apply(generated);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Génération impossible.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { series: loadedSeries } = await api.getContentSeries();
      apply(loadedSeries);
      setLoaded(true);
      if (loadedSeries.length === 0 && !hasAutoGenerated.current) {
        hasAutoGenerated.current = true;
        await generate();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;

  const selected = series.find((s) => s.id === selectedId) ?? null;

  const sideButtonStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    color: color.textSecondary,
    background: color.cardBg,
    border: `1px solid ${color.inputBorder}`,
    borderRadius: 11,
    padding: "10px 12px",
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "32px 36px" }}>
      <h1 style={heading1Style}>Direction</h1>
      <p style={{ margin: "6px 0 20px", color: color.textMuted, fontSize: 15 }}>
        Tes séries, et l&apos;histoire que chacune raconte à ton audience — le rédacteur en chef la planifie, tu la gouvernes
        ici.
      </p>

      <EditorialMixStrip />

      {error && <p style={{ margin: "0 0 14px", fontSize: 13, color: color.danger }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "308px minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: color.textFaint,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "0 2px",
            }}
          >
            Séries · {series.length}
          </div>

          {series.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, color: color.textMuted, lineHeight: 1.5 }}>
              Aucune série pour l&apos;instant — ton activité n&apos;en a peut-être pas besoin, ou ajoutes-en une
              manuellement.
            </p>
          )}

          {series.map((s) => (
            <SeriesCard
              key={s.id}
              series={s}
              selected={s.id === selectedId}
              onSelect={() => setSelectedId(s.id)}
              onEdit={() => setEditing({ series: s })}
            />
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <button onClick={() => setEditing({ series: null })} style={sideButtonStyle}>
              <Plus size={15} strokeWidth={2} />
              Nouvelle série
            </button>
            <button onClick={generate} disabled={generating} style={{ ...sideButtonStyle, opacity: generating ? 0.6 : 1 }}>
              <RefreshCw size={15} strokeWidth={2} />
              {generating ? "..." : "Régénérer avec l'IA"}
            </button>
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          {selected ? (
            <SeriesDetail
              key={selected.id}
              series={selected}
              onSeriesUpdate={(updated) => setSeries((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
            />
          ) : (
            <div
              style={{
                background: color.cardBg,
                border: `1px solid ${color.border}`,
                borderRadius: 14,
                padding: "40px 24px",
                textAlign: "center",
                color: color.textMuted,
                fontSize: 14,
              }}
            >
              Sélectionne une série pour voir l&apos;histoire qu&apos;elle raconte.
            </div>
          )}
        </div>
      </div>

      {editing && (
        <SeriesEditModal
          // Remonte le formulaire quand on passe d'une série à une autre : les champs sont
          // initialisés depuis les props, un simple changement de prop ne les réinitialiserait pas.
          key={editing.series?.id ?? "new"}
          open
          series={editing.series}
          allSeries={series}
          onClose={() => setEditing(null)}
          onSaved={(saved, removedId) => apply(saved, removedId)}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { PlatformBadge, CategoryPill } from "@/components/ui/Badge";
import { api, ApiClientError, type Script } from "@/lib/apiClient";
import { color, fontHeading, platformMeta, scriptStatusOptions, statusMeta, type ScriptStatus } from "@/lib/design/tokens";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  video: "Vidéo",
  visual: "Visuel",
  text: "Texte",
};

function HookBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: color.inputBg, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: color.textFaint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.45, color: color.text2 }}>{value}</div>
    </div>
  );
}

const EMPTY_METRICS_DRAFT = { views: 0, likes: 0, comments: 0, shares: 0 };

export default function ScriptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [script, setScript] = useState<Script | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [metricsDraft, setMetricsDraft] = useState(EMPTY_METRICS_DRAFT);
  const [savingMetrics, setSavingMetrics] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { script } = await api.getScript(params.id);
      setScript(script);
      setMetricsDraft(
        script.metrics
          ? { views: script.metrics.views, likes: script.metrics.likes, comments: script.metrics.comments, shares: script.metrics.shares }
          : EMPTY_METRICS_DRAFT
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Script introuvable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const { script } = await api.regenerateScript(params.id);
      setScript(script);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la régénération.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSaveMetrics() {
    setSavingMetrics(true);
    setError(null);
    try {
      const { metrics } = await api.saveScriptMetrics(params.id, metricsDraft);
      setScript((prev) => (prev ? { ...prev, metrics } : prev));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement des statistiques.");
    } finally {
      setSavingMetrics(false);
    }
  }

  async function handleStatusChange(status: ScriptStatus) {
    if (!script) return;
    const previous = script.status;
    setScript({ ...script, status });
    try {
      await api.updateScriptStatus(params.id, status);
    } catch (err) {
      setScript({ ...script, status: previous });
      setError(err instanceof ApiClientError ? err.message : "Erreur lors du changement de statut.");
    }
  }

  if (loading) return null;

  if (!script) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <p style={{ color: color.danger }}>{error || "Script introuvable."}</p>
        <Button variant="secondary" onClick={() => router.push("/calendar")}>
          ← Retour au calendrier
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900 }}>
      <button
        onClick={() => router.push("/calendar")}
        style={{ background: "none", border: "none", color: color.textMuted, fontFamily: "inherit", fontSize: 14, cursor: "pointer", marginBottom: 18, padding: 0 }}
      >
        ← Retour au calendrier
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, background: "#1c1917", color: "#fff", borderRadius: 20, padding: "5px 12px" }}>
            <PlatformBadge platform={script.platform} size={16} />
            {platformMeta[script.platform].label}
          </span>
          <CategoryPill category={script.contentCategory} />
          {script.series && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "oklch(0.47 0.2 292)", background: "oklch(0.55 0.2 292 / 0.1)", borderRadius: 20, padding: "6px 12px" }}>
              ◈ {script.series.label}
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, background: color.chipBg, borderRadius: 20, padding: "5px 12px" }}>
            {CONTENT_TYPE_LABEL[script.contentType] ?? script.contentType}
          </span>
        </div>
        <Button variant="secondary" onClick={handleRegenerate} disabled={regenerating}>
          {regenerating ? "..." : "↻ Régénérer"}
        </Button>
      </div>

      <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 32, margin: "8px 0 20px", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
        {script.title}
      </h1>

      {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: color.textMuted }}>Statut :</span>
        <div style={{ display: "flex", background: color.chipBg, borderRadius: 10, padding: 3, gap: 2 }}>
          {scriptStatusOptions.map((s) => {
            const active = s === script.status;
            return (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                style={{
                  fontSize: 13,
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  background: active ? color.cardBg : "transparent",
                  color: active ? statusMeta[s].fg : color.textFaint,
                  fontWeight: active ? 600 : 400,
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {statusMeta[s].label}
              </button>
            );
          })}
        </div>
        {script.product && (
          <span style={{ marginLeft: "auto", fontSize: 13, color: color.textMuted, display: "flex", alignItems: "center", gap: 7 }}>
            Produit : <span style={{ fontWeight: 600, color: color.text }}>{script.product.name}</span>
          </span>
        )}
      </div>

      {script.contentType === "video" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ color: "oklch(0.55 0.2 292)" }}>◆</span>L&apos;accroche · 3 premières secondes
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <HookBlock label="Visuel" value={script.hookVisual!} />
            <HookBlock label="Texte à l'écran" value={script.hookText!} />
            <HookBlock label="Audio / voix-off" value={script.hookAudio!} />
          </div>
        </Card>
      )}

      {script.contentType === "visual" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ color: "oklch(0.55 0.2 292)" }}>◆</span>L&apos;accroche visuelle
          </div>
          <HookBlock label="Composition" value={script.hookVisual!} />
        </Card>
      )}

      {script.contentType === "text" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ color: "oklch(0.55 0.2 292)" }}>◆</span>L&apos;accroche
          </div>
          <HookBlock label="Première phrase" value={script.hookText!} />
        </Card>
      )}

      <div
        style={
          script.contentType === "text"
            ? { display: "flex", flexDirection: "column", gap: 16 }
            : { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }
        }
      >
        {script.contentType !== "text" && (
          <Card style={{ padding: 24 }}>
            <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, marginBottom: 18, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "oklch(0.55 0.2 292)" }}>▤</span>
              {script.contentType === "video" ? "Storyboard" : "Slides"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {script.storyboard!.map((s) => (
                <div key={s.planNumber} style={{ display: "flex", gap: 14 }}>
                  <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: "oklch(0.55 0.2 292 / 0.1)", color: "oklch(0.5 0.2 292)", fontWeight: 700, fontSize: 14, display: "grid", placeItems: "center", fontFamily: fontHeading }}>
                    {s.planNumber}
                  </div>
                  <div style={{ flex: 1, paddingTop: 3 }}>
                    <div style={{ fontSize: 14, lineHeight: 1.4, color: color.text2 }}>{s.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: color.textSecondary, marginBottom: 10 }}>
              {script.contentType === "text" ? "Texte" : "Légende"}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5, color: color.text2, whiteSpace: "pre-wrap" }}>{script.caption}</div>
          </Card>
          {script.hashtags.length > 0 && (
            <Card style={{ padding: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: color.textSecondary, marginBottom: 12 }}>Hashtags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {script.hashtags.map((h) => (
                  <span key={h} style={{ fontSize: 13, color: "oklch(0.5 0.2 292)", background: "oklch(0.55 0.2 292 / 0.08)", borderRadius: 8, padding: "5px 10px" }}>
                    {h}
                  </span>
                ))}
              </div>
            </Card>
          )}
          {script.contentType === "video" && (
            <Card style={{ padding: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: color.textSecondary, marginBottom: 10 }}>Son / tendance</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: "oklch(0.62 0.12 250 / 0.14)", color: "oklch(0.45 0.14 250)", display: "grid", placeItems: "center", fontSize: 17, flexShrink: 0 }}>
                  ♪
                </span>
                <div style={{ fontSize: 14, lineHeight: 1.4, color: color.text2 }}>{script.soundRecommendation}</div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {script.status === "published" && (
        <Card style={{ padding: 22, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: color.textSecondary, marginBottom: 4 }}>Performance</div>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: color.textMuted }}>
            Saisis les statistiques du post publié — ça oriente les prochaines générations vers ce qui marche.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
            {(["views", "likes", "comments", "shares"] as const).map((field) => (
              <div key={field}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: color.textFaint, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                  {{ views: "Vues", likes: "Likes", comments: "Commentaires", shares: "Partages" }[field]}
                </label>
                <input
                  type="number"
                  min={0}
                  value={metricsDraft[field]}
                  onChange={(e) => setMetricsDraft((d) => ({ ...d, [field]: Math.max(0, Number(e.target.value)) }))}
                  style={{
                    width: "100%",
                    border: `1px solid ${color.inputBorder}`,
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 13,
                    fontFamily: "inherit",
                    background: color.cardBg,
                  }}
                />
              </div>
            ))}
          </div>
          <Button onClick={handleSaveMetrics} disabled={savingMetrics} style={{ padding: "8px 16px", fontSize: 13 }}>
            {savingMetrics ? "..." : "Enregistrer"}
          </Button>
        </Card>
      )}
    </div>
  );
}

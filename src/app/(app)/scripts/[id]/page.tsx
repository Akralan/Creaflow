"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import BrandAssetLibrary from "@/components/BrandAssetLibrary/BrandAssetLibrary";
import BriefHeader from "@/components/ScriptEditor/BriefHeader";
import EditableField from "@/components/ScriptEditor/EditableField";
import { api, ApiClientError, type Script } from "@/lib/apiClient";
import { color, fontHeading, scriptStatusOptions, statusMeta, type ScriptStatus } from "@/lib/design/tokens";

const EMPTY_METRICS_DRAFT = { views: 0, likes: 0, comments: 0, shares: 0 };
const HISTORY_LIMIT = 20;

function RegenerateButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title="Régénérer uniquement ce bloc"
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: "oklch(0.5 0.2 292)",
        background: "oklch(0.55 0.2 292 / 0.08)",
        border: "none",
        borderRadius: 8,
        padding: "5px 10px",
        cursor: "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? "..." : "↻ Régénérer"}
    </button>
  );
}

export default function ScriptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [script, setScript] = useState<Script | null>(null);
  const [history, setHistory] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingBlock, setRegeneratingBlock] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [metricsDraft, setMetricsDraft] = useState(EMPTY_METRICS_DRAFT);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);

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

  /** Empile l'état courant avant toute écriture — chaque patch/micro-retouche est undo-able. */
  function pushHistory() {
    if (!script) return;
    setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), script]);
  }

  async function handleUndo() {
    const previous = history.at(-1);
    if (!previous || !script) return;
    setHistory((h) => h.slice(0, -1));
    setError(null);
    try {
      // Persiste le retour arrière (§4.4) — l'undo n'est pas seulement visuel.
      const { script: reverted } = await api.patchScriptContent(script.id, {
        title: previous.title ?? undefined,
        hookVisual: previous.hookVisual ?? undefined,
        hookText: previous.hookText ?? undefined,
        hookAudio: previous.hookAudio ?? undefined,
        storyboard: previous.storyboard ?? undefined,
        caption: previous.caption,
        hashtags: previous.hashtags,
        soundRecommendation: previous.soundRecommendation ?? undefined,
      });
      // patchScriptContent ne renvoie que les colonnes patchées, pas les relations jointes
      // (product/contentCategory/angle/série/citations...) — fusion, jamais un remplacement complet,
      // sous peine d'effacer ces sections de l'affichage (ex. « Matière utilisée pour ce script »).
      setScript((prev) => (prev ? { ...prev, ...reverted } : reverted));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'annulation.");
    }
  }

  async function saveField(patch: Parameters<typeof api.patchScriptContent>[1]) {
    if (!script) return;
    pushHistory();
    setError(null);
    try {
      const { script: updated } = await api.patchScriptContent(script.id, patch);
      setScript((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement.");
    }
  }

  async function applyInstruction(blockField: string, selectedText: string, instruction: string) {
    if (!script) return;
    pushHistory();
    setError(null);
    try {
      const { script: updated } = await api.applySelectionInstruction(script.id, { blockField, selectedText, instruction });
      setScript((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la retouche.");
    }
  }

  async function regenerateBlock(block: "hook" | "storyboard" | "caption" | "hashtags") {
    if (!script) return;
    pushHistory();
    setRegeneratingBlock(block);
    setError(null);
    try {
      const { script: updated } = await api.regenerateScriptBlock(script.id, block);
      setScript((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la régénération du bloc.");
    } finally {
      setRegeneratingBlock(null);
    }
  }

  async function handleDelete() {
    if (!script) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteScript(script.id);
      router.push("/calendar");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la suppression.");
      setDeleting(false);
    }
  }

  async function handleSaveMetrics() {
    if (!script) return;
    setSavingMetrics(true);
    setError(null);
    try {
      const { metrics } = await api.saveScriptMetrics(script.id, metricsDraft);
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
      await api.updateScriptStatus(script.id, status);
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <button
          onClick={() => router.push("/calendar")}
          style={{ background: "none", border: "none", color: color.textMuted, fontFamily: "inherit", fontSize: 14, cursor: "pointer", padding: 0 }}
        >
          ← Retour au calendrier
        </button>
        {history.length > 0 && (
          <button
            onClick={handleUndo}
            style={{ background: "none", border: "none", color: color.textMuted, fontFamily: "inherit", fontSize: 13, cursor: "pointer", padding: 0 }}
          >
            ↺ Annuler la dernière modification
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 8 }}>
        <BriefHeader script={script} />
        <Button variant="secondary" onClick={() => setConfirmDelete(true)} style={{ color: color.danger }}>
          Supprimer
        </Button>
      </div>

      <div style={{ margin: "8px 0 20px" }}>
        <input
          value={script.title ?? ""}
          placeholder="(sans titre)"
          onChange={(e) => setScript({ ...script, title: e.target.value })}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== (history.at(-1)?.title ?? script.title)) {
              saveField({ title: e.target.value });
            }
          }}
          style={{
            width: "100%",
            fontFamily: fontHeading,
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
            border: "none",
            outline: "none",
            background: "none",
            color: color.text,
            padding: 0,
          }}
        />
      </div>

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
            Sujet : <span style={{ fontWeight: 600, color: color.text }}>{script.product.name}</span>
          </span>
        )}
      </div>

      {script.contentType === "video" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "oklch(0.55 0.2 292)" }}>◆</span>L&apos;accroche · 3 premières secondes
            </div>
            <RegenerateButton onClick={() => regenerateBlock("hook")} busy={regeneratingBlock === "hook"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {(["hookVisual", "hookText", "hookAudio"] as const).map((field, i) => (
              <div key={field}>
                <div style={{ fontSize: 11, fontWeight: 700, color: color.textFaint, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {["Visuel", "Texte à l'écran", "Audio / voix-off"][i]}
                </div>
                <EditableField
                  value={script[field] ?? ""}
                  minRows={3}
                  onSave={(v) => saveField({ [field]: v })}
                  onApplyInstruction={(text, instr) => applyInstruction(field, text, instr)}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {script.contentType === "visual" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "oklch(0.55 0.2 292)" }}>◆</span>L&apos;accroche visuelle
            </div>
            <RegenerateButton onClick={() => regenerateBlock("hook")} busy={regeneratingBlock === "hook"} />
          </div>
          <EditableField
            value={script.hookVisual ?? ""}
            onSave={(v) => saveField({ hookVisual: v })}
            onApplyInstruction={(text, instr) => applyInstruction("hookVisual", text, instr)}
          />
        </Card>
      )}

      {script.contentType === "visual" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ color: "oklch(0.55 0.2 292)" }}>▧</span>Visuel
          </div>
          {script.generatedImage ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={script.generatedImage.url}
                alt={script.title ?? "Visuel généré"}
                style={{ width: "100%", borderRadius: 12, display: "block", marginBottom: 12 }}
              />
              <Button variant="secondary" onClick={() => setShowAssetLibrary(true)} style={{ padding: "8px 16px", fontSize: 13 }}>
                Regénérer avec d&apos;autres photos
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
                Pour produire le visuel, j&apos;ai besoin de photos de ta marque.
              </p>
              <Button variant="secondary" onClick={() => setShowAssetLibrary(true)}>
                Générer le visuel
              </Button>
            </div>
          )}
        </Card>
      )}

      <Modal open={showAssetLibrary} onClose={() => setShowAssetLibrary(false)} width={640}>
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20, margin: "0 0 4px" }}>Ressources visuelles</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted }}>
          Choisis une ou plusieurs photos de ta marque, puis décris la mise en scène souhaitée.
        </p>
        <BrandAssetLibrary
          scriptId={script.id}
          onGenerated={(image) => {
            setScript((prev) => (prev ? { ...prev, generatedImageId: image.id, generatedImage: image } : prev));
            setShowAssetLibrary(false);
          }}
        />
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} width={420}>
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Supprimer ce brouillon ?</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted }}>
          Le créneau du calendrier redevient vide et pourra être régénéré. Cette action est irréversible.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Annuler
          </Button>
          <Button onClick={handleDelete} disabled={deleting} style={{ background: color.danger }}>
            {deleting ? "..." : "Supprimer"}
          </Button>
        </div>
      </Modal>

      {script.contentType === "text" && (
        <Card style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ color: "oklch(0.55 0.2 292)" }}>◆</span>L&apos;accroche
            </div>
            <RegenerateButton onClick={() => regenerateBlock("hook")} busy={regeneratingBlock === "hook"} />
          </div>
          {/* Aligne l'accroche (et le titre si besoin) sur le texte actuel, sans jamais réécrire le
              texte lui-même — le vrai geste d'édition du corps reste sélection→instruction. */}
          <EditableField
            value={script.hookText ?? ""}
            onSave={(v) => saveField({ hookText: v })}
            onApplyInstruction={(text, instr) => applyInstruction("hookText", text, instr)}
          />
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ color: "oklch(0.55 0.2 292)" }}>▤</span>
                {script.contentType === "video" ? "Storyboard" : "Slides"}
              </div>
              <RegenerateButton onClick={() => regenerateBlock("storyboard")} busy={regeneratingBlock === "storyboard"} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(script.storyboard ?? []).map((s, i) => (
                <div key={s.planNumber} style={{ display: "flex", gap: 14 }}>
                  <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 9, background: "oklch(0.55 0.2 292 / 0.1)", color: "oklch(0.5 0.2 292)", fontWeight: 700, fontSize: 14, display: "grid", placeItems: "center", fontFamily: fontHeading }}>
                    {s.planNumber}
                  </div>
                  <div style={{ flex: 1, paddingTop: 3 }}>
                    <EditableField
                      value={s.description}
                      minRows={2}
                      onSave={(v) => {
                        const storyboard = (script.storyboard ?? []).map((step, j) => (j === i ? { ...step, description: v } : step));
                        saveField({ storyboard });
                      }}
                      onApplyInstruction={(text, instr) => applyInstruction(`storyboard.${i}`, text, instr)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: color.textSecondary }}>
                {script.contentType === "text" ? "Texte" : "Légende"}
              </div>
              {/* Pas de régénération en bloc pour le texte : personne ne relance une génération à
                  l'aveugle en espérant un bon résultat — l'édition se fait petit bout par petit bout
                  via la sélection (EditableField), qui a accès à la matière du sujet. */}
              {script.contentType !== "text" && (
                <RegenerateButton onClick={() => regenerateBlock("caption")} busy={regeneratingBlock === "caption"} />
              )}
            </div>
            <EditableField
              value={script.caption}
              minRows={script.contentType === "text" ? 8 : 4}
              onSave={(v) => saveField({ caption: v })}
              onApplyInstruction={(text, instr) => applyInstruction("caption", text, instr)}
            />
          </Card>
          <Card style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: color.textSecondary }}>Hashtags</div>
              <RegenerateButton onClick={() => regenerateBlock("hashtags")} busy={regeneratingBlock === "hashtags"} />
            </div>
            <input
              defaultValue={script.hashtags.join(" ")}
              placeholder="#marque #niche"
              onBlur={(e) => {
                const hashtags = e.target.value.split(/\s+/).map((h) => h.trim()).filter(Boolean);
                if (JSON.stringify(hashtags) !== JSON.stringify(script.hashtags)) saveField({ hashtags });
              }}
              style={{
                width: "100%",
                border: `1px solid ${color.inputBorder}`,
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13,
                fontFamily: "inherit",
                background: color.inputBg,
                color: "oklch(0.5 0.2 292)",
              }}
            />
          </Card>
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

      {script.citations && script.citations.length > 0 && (
        <Card style={{ padding: 22, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: color.textSecondary, marginBottom: 4 }}>
            Matière utilisée pour ce script
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: color.textMuted }}>
            Passages rapportés par l&apos;IA comme base factuelle — utile pour vérifier ce qui a réellement été repris
            depuis ta matière (docs/SPEC_MATIERE_EDITEUR.md §3).
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {script.citations.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span
                  title={c.matched ? "Localisé dans le document source" : "Non localisé — le texte source a pu changer"}
                  style={{
                    flexShrink: 0,
                    marginTop: 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: c.matched ? "oklch(0.5 0.16 150)" : color.textFaint,
                    background: c.matched ? "oklch(0.5 0.16 150 / 0.12)" : color.chipBg,
                  }}
                >
                  {c.matched ? "✓" : "✗"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {c.sourceMaterialTitle && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: color.textFaint, marginBottom: 2 }}>
                      {c.sourceMaterialTitle}
                    </div>
                  )}
                  <div style={{ fontSize: 13, lineHeight: 1.4, color: color.text2 }}>&laquo;&nbsp;{c.excerpt}&nbsp;&raquo;</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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

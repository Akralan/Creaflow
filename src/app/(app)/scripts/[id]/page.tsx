"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import DesignEditor from "@/components/DesignEditor/DesignEditor";
import { ActionsMenu, BriefInfo, StatusDropdown, UndoButton } from "@/components/ScriptEditor/HeaderControls";
import PlatformLogo from "@/components/calendar/PlatformLogo";
import layout from "@/components/ScriptEditor/script.module.css";
import EditableField from "@/components/ScriptEditor/EditableField";
import TitleField from "@/components/ScriptEditor/TitleField";
import { api, ApiClientError, type Script } from "@/lib/apiClient";
import { accentAlpha, color, fontHeading, fontMono, platformMeta, type ScriptStatus } from "@/lib/design/tokens";

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

const sectionLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: color.textSecondary };

/** Même seuil que STYLE_LEARNING_SUGGESTION_THRESHOLD (styleLearningService.ts). */
const STYLE_SUGGESTION_THRESHOLD = 5;

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
  const [confirmNewIdea, setConfirmNewIdea] = useState(false);
  const [newIdeaDirective, setNewIdeaDirective] = useState("");
  const [applyingNewIdea, setApplyingNewIdea] = useState(false);
  const [metricsDraft, setMetricsDraft] = useState(EMPTY_METRICS_DRAFT);
  const [savingMetrics, setSavingMetrics] = useState(false);
  // Suggestion d'analyse de style après finalisation (docs/SPEC_APPRENTISSAGE_STYLE.md §6.2) :
  // nombre de scripts corrigés non analysés, affiché seulement à partir du seuil, jamais bloquant.
  const [styleSuggestion, setStyleSuggestion] = useState<number | null>(null);
  // Logo de l'identité de marque (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2) : dit à l'éditeur de
  // maquette si {{LOGO}} peut être résolu.
  const [hasLogo, setHasLogo] = useState(false);
  // Nom affiché sur l'aperçu d'un post texte, comme sur le réseau.
  const [authorName, setAuthorName] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { script } = await api.getScript(params.id);
      setScript(script);
      api
        .getProfile()
        .then(({ profile }) => {
          setHasLogo(Boolean(profile?.brandKit?.logoAssetId));
          setAuthorName(profile?.brandName ?? "");
        })
        .catch(() => {});
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

  /** Relecture silencieuse (composition automatique de la maquette en arrière-plan) : ne touche
   *  qu'à la maquette, pour ne pas écraser une saisie en cours ailleurs sur la fiche. */
  const reloadQuietly = useCallback(async () => {
    const { script: fresh } = await api.getScript(params.id);
    setScript((prev) => (prev ? { ...prev, visualDesign: fresh.visualDesign ?? null } : fresh));
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
        storyboard: previous.storyboard ?? undefined,
        caption: previous.caption,
        hashtags: previous.hashtags,
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
      // Les mots de la maquette viennent du storyboard : le serveur la passe en "stale", on
      // reflète ce statut sans recharger (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2).
      const touchesDesign = patch.title !== undefined || patch.hookVisual !== undefined || patch.storyboard !== undefined;
      setScript((prev) =>
        prev
          ? { ...prev, ...updated, visualDesign: prev.visualDesign && touchesDesign ? { ...prev.visualDesign, status: "stale" } : prev.visualDesign }
          : updated
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement.");
    }
  }

  async function applyInstruction(blockField: string, selectedText: string, instruction: string, isMajoritySelection: boolean) {
    if (!script) return;
    // Bascule select-all (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A/§7) : une sélection ≥80% du bloc +
    // un commentaire soumis est un geste d'intention, pas une retouche — on ouvre la confirmation
    // nouvelle-idée avec le commentaire pré-rempli en directive, sans appeler rewrite_selection.
    if (isMajoritySelection) {
      setNewIdeaDirective(instruction);
      setConfirmNewIdea(true);
      return;
    }
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

  /** "Autre idée, même brief" (docs/SPEC_PROMPT_GENERATION_TECH.md §6) — remplace tout le contenu en
   *  place, brief verrouillé (plateforme/catégorie/angle/série inchangés). Geste distinct des
   *  régénérations de bloc : intention, pas mots — confirmation systématique avant exécution (§6.3). */
  async function handleNewIdea() {
    if (!script) return;
    pushHistory();
    setConfirmNewIdea(false);
    setApplyingNewIdea(true);
    setError(null);
    try {
      const directive = newIdeaDirective.trim();
      const { script: updated } = await api.newIdea(script.id, directive ? { directive } : undefined);
      setScript((prev) => (prev ? { ...prev, ...updated } : updated));
      setNewIdeaDirective("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la génération d'une autre idée.");
    } finally {
      setApplyingNewIdea(false);
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
      if (status === "shot" || status === "published") {
        api
          .getProfile()
          .then(({ styleLearning }) => {
            if (styleLearning.pendingScripts >= STYLE_SUGGESTION_THRESHOLD && !styleLearning.pendingProposalId) {
              setStyleSuggestion(styleLearning.pendingScripts);
            }
          })
          .catch(() => {});
      }
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

  const isText = script.contentType === "text";
  const textLabel = isText ? "Texte" : "Texte du post";

  return (
    <div className={layout.page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <button
          onClick={() => router.push("/calendar")}
          style={{ background: "none", border: "none", color: color.textMuted, fontFamily: "inherit", fontSize: 14, cursor: "pointer", padding: 0 }}
        >
          ← Calendrier
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {history.length > 0 && <UndoButton onClick={handleUndo} />}
          <BriefInfo script={script} />
          <ActionsMenu
            canNewIdea={script.origin === "generated" && Boolean(script.concept)}
            hasSeries={Boolean(script.series)}
            busy={applyingNewIdea}
            onNewIdea={() => {
              setNewIdeaDirective("");
              setConfirmNewIdea(true);
            }}
            onDelete={() => setConfirmDelete(true)}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <TitleField title={script.title} onSave={(next) => saveField({ title: next })} />
        </div>
        <StatusDropdown status={script.status} onChange={handleStatusChange} />
      </div>

      {applyingNewIdea && <p style={{ color: color.textMuted, fontSize: 13, margin: "0 0 14px" }}>On rédige une autre idée…</p>}
      {error && <p style={{ color: color.danger, fontSize: 13, margin: "0 0 14px" }}>{error}</p>}

      {styleSuggestion !== null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${accentAlpha(0.25)}`,
            background: accentAlpha(0.06),
            fontSize: 13,
          }}
        >
          <span style={{ flex: 1 }}>
            Tu as corrigé {styleSuggestion} scripts depuis la dernière analyse de style. L&apos;analyser pour que les prochains
            demandent moins de retouches ?
          </span>
          <button
            onClick={() => router.push("/settings")}
            style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "oklch(0.48 0.2 292)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Analyser →
          </button>
          <button
            onClick={() => setStyleSuggestion(null)}
            title="Plus tard"
            style={{ fontFamily: "inherit", fontSize: 12, color: color.textFaint, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      <div className={layout.layout}>
        {/* Le post lui-même : la maquette pour un visuel, le post rendu pour un texte. */}
        <div style={{ minWidth: 0 }}>
          {isText ? (
            <Card style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${accentAlpha(0.6)}, oklch(0.55 0.2 292))`, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: color.text }}>{authorName || "Toi"}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.textFaint, fontFamily: fontMono }}>
                    <PlatformLogo platform={script.platform} size={13} />
                    {platformMeta[script.platform]?.label ?? script.platform} · texte
                  </span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={sectionLabel}>Accroche</div>
                <RegenerateButton onClick={() => regenerateBlock("hook")} busy={regeneratingBlock === "hook"} />
              </div>
              {/* Aligne l'accroche (et le titre si besoin) sur le texte actuel, sans jamais réécrire le
                  texte lui-même — le vrai geste d'édition du corps reste sélection→instruction. */}
              <EditableField
                value={script.hookText ?? ""}
                onSave={(v) => saveField({ hookText: v })}
                onApplyInstruction={(text, instr, isMajority) => applyInstruction("hookText", text, instr, isMajority)}
              />
              <div style={{ ...sectionLabel, margin: "18px 0 6px" }}>{textLabel}</div>
              {/* Pas de régénération en bloc pour le texte : l'édition se fait petit bout par petit
                  bout via la sélection (EditableField), qui a accès à la matière du sujet. */}
              <EditableField
                value={script.caption}
                minRows={12}
                onSave={(v) => saveField({ caption: v })}
                onApplyInstruction={(text, instr, isMajority) => applyInstruction("caption", text, instr, isMajority)}
              />
            </Card>
          ) : (
            <Card style={{ padding: 20 }}>
              <DesignEditor
                script={script}
                hasLogo={hasLogo}
                onDesignChange={(design) => setScript((prev) => (prev ? { ...prev, visualDesign: design } : prev))}
                onReload={reloadQuietly}
              />
            </Card>
          )}
        </div>

        {/* Ce qui accompagne le post, toujours sous les yeux. */}
        <aside className={layout.aside}>
          {!isText && (
            <Card style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={sectionLabel}>{textLabel}</div>
                <RegenerateButton onClick={() => regenerateBlock("caption")} busy={regeneratingBlock === "caption"} />
              </div>
              <EditableField
                value={script.caption}
                minRows={8}
                onSave={(v) => saveField({ caption: v })}
                onApplyInstruction={(text, instr, isMajority) => applyInstruction("caption", text, instr, isMajority)}
              />
            </Card>
          )}

          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={sectionLabel}>Hashtags</div>
              <RegenerateButton onClick={() => regenerateBlock("hashtags")} busy={regeneratingBlock === "hashtags"} />
            </div>
            <input
              key={script.hashtags.join(" ")}
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

          {script.citations && script.citations.length > 0 && (
            <Card style={{ padding: 0 }}>
              <details className={layout.sources}>
                <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
                  <span style={sectionLabel}>Sources</span>
                  <span style={{ fontSize: 12, color: color.textMuted }}>
                    {script.citations.length} passage{script.citations.length > 1 ? "s" : ""} de ta matière ▾
                  </span>
                </summary>
                <div style={{ padding: "0 20px 18px" }}>
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
                            <div style={{ marginBottom: 4 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: fontMono,
                                  color: color.textSecondary,
                                  background: color.chipBg,
                                  borderRadius: 6,
                                  padding: "2px 8px",
                                }}
                              >
                                {c.sourceMaterialTitle}
                              </span>
                            </div>
                          )}
                          <div style={{ fontSize: 13, lineHeight: 1.4, color: color.text2 }}>&laquo;&nbsp;{c.excerpt}&nbsp;&raquo;</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </Card>
          )}

          {script.status === "published" && (
            <Card style={{ padding: 20 }}>
              <div style={{ ...sectionLabel, marginBottom: 4 }}>Performance</div>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: color.textMuted }}>
                Les statistiques du post publié orientent les prochains vers ce qui marche.
              </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 14 }}>
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
        </aside>
      </div>

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

      <Modal open={confirmNewIdea} onClose={() => setConfirmNewIdea(false)} width={420}>
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Partir sur une autre idée ?</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted }}>
          Tout le contenu de ce script sera remplacé par une nouvelle génération — plateforme, catégorie, angle et série restent inchangés. Si tu as modifié le texte à la main, ces modifications seront perdues. Cette action est irréversible.
        </p>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: color.textFaint, marginBottom: 6 }}>
          Une idée en tête ? <span style={{ fontWeight: 400 }}>(optionnel)</span>
        </label>
        <textarea
          value={newIdeaDirective}
          onChange={(e) => setNewIdeaDirective(e.target.value)}
          placeholder="Une piste à interpréter, pas un texte à recopier..."
          rows={3}
          maxLength={500}
          style={{
            width: "100%",
            border: `1px solid ${color.inputBorder}`,
            borderRadius: 10,
            padding: "9px 11px",
            fontSize: 13,
            lineHeight: 1.4,
            fontFamily: "inherit",
            background: color.inputBg,
            color: color.text2,
            resize: "vertical",
            marginBottom: 18,
          }}
        />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setConfirmNewIdea(false)}>
            Annuler
          </Button>
          <Button onClick={handleNewIdea} disabled={applyingNewIdea}>
            {applyingNewIdea ? "..." : "Générer une autre idée"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

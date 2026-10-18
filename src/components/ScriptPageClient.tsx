"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import GenerationPanel from "@/components/GenerationPanel";
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
      title="Regenerate this block only"
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
      {busy ? "..." : "↻ Regenerate"}
    </button>
  );
}

const sectionLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: color.textSecondary };

/** Same threshold as STYLE_LEARNING_SUGGESTION_THRESHOLD (styleLearningService.ts). */
const STYLE_SUGGESTION_THRESHOLD = 5;

/**
 * The former detail page of a script. A script with a slot now opens on « Your content week »
 * (docs/SPEC_APP_DESIGN_TELLOVO.md E8); this page only serves scripts without a slot (imported, free).
 */
export default function ScriptPageClient() {
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
  // Style analysis suggestion after finalisation (docs/SPEC_APPRENTISSAGE_STYLE.md §6.2):
  // number of edited scripts not yet analysed, shown only past the threshold, never blocking.
  const [styleSuggestion, setStyleSuggestion] = useState<number | null>(null);
  // Brand identity logo (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2): tells the mockup editor
  // whether {{LOGO}} can be resolved.
  const [hasLogo, setHasLogo] = useState(false);
  // Name shown on the preview of a text post, as on the network.
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
      setError(err instanceof ApiClientError ? err.message : "Script not found.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  /** Silent reload (automatic mockup composition in the background): only touches
   *  the mockup, so as not to overwrite input in progress elsewhere on the page. */
  const reloadQuietly = useCallback(async () => {
    const { script: fresh } = await api.getScript(params.id);
    setScript((prev) => (prev ? { ...prev, visualDesign: fresh.visualDesign ?? null } : fresh));
  }, [params.id]);

  /** Pushes the current state before any write — every patch/micro-edit is undoable. */
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
      // Persists the rollback (§4.4) — undo is not only visual.
      const { script: reverted } = await api.patchScriptContent(script.id, {
        title: previous.title ?? undefined,
        hookVisual: previous.hookVisual ?? undefined,
        hookText: previous.hookText ?? undefined,
        storyboard: previous.storyboard ?? undefined,
        caption: previous.caption,
        hashtags: previous.hashtags,
      });
      // patchScriptContent only returns the patched columns, not the joined relations
      // (product/contentCategory/angle/series/citations...) — merge, never a full replacement,
      // or those sections vanish from the display (e.g. "Material used for this script").
      setScript((prev) => (prev ? { ...prev, ...reverted } : reverted));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while undoing.");
    }
  }

  async function saveField(patch: Parameters<typeof api.patchScriptContent>[1]) {
    if (!script) return;
    pushHistory();
    setError(null);
    try {
      const { script: updated } = await api.patchScriptContent(script.id, patch);
      // The mockup's words come from the storyboard: the server marks it "stale", we
      // reflect that status without reloading (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2).
      const touchesDesign = patch.title !== undefined || patch.hookVisual !== undefined || patch.storyboard !== undefined;
      setScript((prev) =>
        prev
          ? { ...prev, ...updated, visualDesign: prev.visualDesign && touchesDesign ? { ...prev.visualDesign, status: "stale" } : prev.visualDesign }
          : updated
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while saving.");
    }
  }

  async function applyInstruction(blockField: string, selectedText: string, instruction: string, isMajoritySelection: boolean) {
    if (!script) return;
    // Select-all switch (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A/§7): a selection of ≥80% of the block +
    // a submitted comment is a gesture of intent, not an edit — we open the new-idea confirmation
    // with the comment pre-filled as the directive, without calling rewrite_selection.
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
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while editing.");
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
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while regenerating the block.");
    } finally {
      setRegeneratingBlock(null);
    }
  }

  /** "Another idea, same brief" (docs/SPEC_PROMPT_GENERATION_TECH.md §6) — replaces all the content in
   *  place, brief locked (platform/category/angle/series unchanged). A gesture distinct from
   *  block regenerations: intent, not words — always confirmed before running (§6.3). */
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
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while generating another idea.");
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
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while deleting.");
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
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while saving the stats.");
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
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while changing the status.");
    }
  }

  if (loading) return null;

  if (!script) {
    return (
      <div style={{ padding: "32px 36px" }}>
        <p style={{ color: color.danger }}>{error || "Script not found."}</p>
        <Button variant="secondary" onClick={() => router.push("/calendar")}>
          ← Back to calendar
        </Button>
      </div>
    );
  }

  const isText = script.contentType === "text";
  const textLabel = isText ? "Text" : "Post text";

  return (
    <div className={layout.page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <button
          onClick={() => router.push("/calendar")}
          style={{ background: "none", border: "none", color: color.textMuted, fontFamily: "inherit", fontSize: 14, cursor: "pointer", padding: 0 }}
        >
          ← Calendar
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

      {applyingNewIdea && (
        <div style={{ margin: "0 0 18px", border: `1px solid ${color.border}`, background: color.cardBg, borderRadius: 16, padding: "18px 20px" }}>
          <GenerationPanel title="Writing another idea" output={{ kind: "text" }} />
        </div>
      )}
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
            You&apos;ve edited {styleSuggestion} scripts since the last style analysis. Analyze them so the next ones
            need fewer edits?
          </span>
          <button
            onClick={() => router.push("/settings")}
            style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "oklch(0.48 0.2 292)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Analyze →
          </button>
          <button
            onClick={() => setStyleSuggestion(null)}
            title="Later"
            style={{ fontFamily: "inherit", fontSize: 12, color: color.textFaint, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      <div className={layout.layout}>
        {/* The post itself: the mockup for a visual, the rendered post for a text. */}
        <div style={{ minWidth: 0 }}>
          {isText ? (
            <Card style={{ padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <span style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg, ${accentAlpha(0.6)}, oklch(0.55 0.2 292))`, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 15, color: color.text }}>{authorName || "You"}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.textFaint, fontFamily: fontMono }}>
                    <PlatformLogo platform={script.platform} size={13} />
                    {platformMeta[script.platform]?.label ?? script.platform} · text
                  </span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={sectionLabel}>Hook</div>
                <RegenerateButton onClick={() => regenerateBlock("hook")} busy={regeneratingBlock === "hook"} />
              </div>
              {/* Aligns the hook (and the title if needed) with the current text, without ever rewriting
                  the text itself — the real way to edit the body stays selection→instruction. */}
              <EditableField
                value={script.hookText ?? ""}
                onSave={(v) => saveField({ hookText: v })}
                onApplyInstruction={(text, instr, isMajority) => applyInstruction("hookText", text, instr, isMajority)}
              />
              <div style={{ ...sectionLabel, margin: "18px 0 6px" }}>{textLabel}</div>
              {/* No block regeneration for the text: editing happens bit by bit
                  through selection (EditableField), which has access to the topic's material. */}
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

        {/* What goes with the post, always in view. */}
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
              placeholder="#brand #niche"
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
                    {script.citations.length} passage{script.citations.length > 1 ? "s" : ""} from your material ▾
                  </span>
                </summary>
                <div style={{ padding: "0 20px 18px" }}>
          <div style={{ display: "grid", gap: 10 }}>
                    {script.citations.map((c) => (
                      <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span
                          title={c.matched ? "Found in the source document" : "Not found — the source text may have changed"}
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
                          <div style={{ fontSize: 13, lineHeight: 1.4, color: color.text2 }}>&ldquo;{c.excerpt}&rdquo;</div>
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
                The published post&apos;s stats steer the next ones toward what works.
              </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 14 }}>
            {(["views", "likes", "comments", "shares"] as const).map((field) => (
              <div key={field}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: color.textFaint, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                  {{ views: "Views", likes: "Likes", comments: "Comments", shares: "Shares" }[field]}
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
            {savingMetrics ? "..." : "Save"}
          </Button>
            </Card>
          )}
        </aside>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} width={420}>
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Delete this draft?</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted }}>
          The calendar slot becomes empty again and can be regenerated. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button onClick={handleDelete} disabled={deleting} style={{ background: color.danger }}>
            {deleting ? "..." : "Delete"}
          </Button>
        </div>
      </Modal>

      <Modal open={confirmNewIdea} onClose={() => setConfirmNewIdea(false)} width={420}>
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Go with another idea?</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted }}>
          All the content of this script will be replaced by a new generation — platform, category, angle and series stay unchanged. If you edited the text by hand, those edits will be lost. This cannot be undone.
        </p>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: color.textFaint, marginBottom: 6 }}>
          An idea in mind? <span style={{ fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={newIdeaDirective}
          onChange={(e) => setNewIdeaDirective(e.target.value)}
          placeholder="A direction to interpret, not a text to copy..."
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
            Cancel
          </Button>
          <Button onClick={handleNewIdea} disabled={applyingNewIdea}>
            {applyingNewIdea ? "..." : "Generate another idea"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

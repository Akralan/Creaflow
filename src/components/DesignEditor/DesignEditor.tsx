"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Redo2, RefreshCw, Trash2, Undo2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import AssetGrid from "@/components/BrandAssetLibrary/AssetGrid";
import { api, ApiClientError, type BrandAsset, type DesignTheme, type Script, type VisualDesign } from "@/lib/apiClient";
import { accentAlpha, color, fontHeading } from "@/lib/design/tokens";
import { DESIGN_FORMATS, defaultFormatForPlatform, type DesignFormatId } from "@/lib/visualDesign/formats";
import DesignCanvas from "./DesignCanvas";
import LayerInspector from "./LayerInspector";
import {
  describeLayer,
  fromRenderedHtml,
  moveLayer,
  nextPlanNumber,
  removeLayer,
  toRenderableHtml,
  updateLayerStyle,
  type RenderUrls,
} from "./designDom";
import { downloadBlob, renderSlideToPng, zipBlobs } from "./exportSlides";

type LocalSlide = { planNumber: number; html: string };

const CANVAS_WIDTH = 520;
const SAVE_DEBOUNCE_MS = 800;

function formatIdOf(design: VisualDesign): DesignFormatId {
  const found = (Object.keys(DESIGN_FORMATS) as DesignFormatId[]).find((id) => DESIGN_FORMATS[id].width === design.width && DESIGN_FORMATS[id].height === design.height);
  return found ?? "square";
}

/**
 * Section « Design » de l'éditeur d'un post visuel (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §3, §6).
 * Deux modes : sans maquette → choix de la base et création par l'agent ; avec maquette → canevas
 * éditable à la main, inspecteur, instruction à l'agent, export PNG.
 */
export default function DesignEditor({
  script,
  hasLogo,
  onDesignChange,
  onOpenStagedPhoto,
}: {
  script: Script;
  hasLogo: boolean;
  onDesignChange: (design: VisualDesign | null) => void;
  /** Ouvre le flux existant de photo mise en scène (modale bibliothèque). */
  onOpenStagedPhoto: () => void;
}) {
  const design = script.visualDesign ?? null;
  const [slides, setSlides] = useState<LocalSlide[]>([]);
  const [theme, setTheme] = useState<DesignTheme | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<LocalSlide[][]>([]);
  const [redoStack, setRedoStack] = useState<LocalSlide[][]>([]);
  const [instruction, setInstruction] = useState("");
  const [scope, setScope] = useState<"slide" | "all">("slide");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [format, setFormat] = useState<DesignFormatId>(defaultFormatForPlatform(script.platform));
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [pickedAssetId, setPickedAssetId] = useState<string | null>(null);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // Resynchronise l'état local quand la maquette change de version (création, instruction,
  // recomposition) — ajustement d'état pendant le rendu, pattern React « adjusting state when a
  // prop changes », plutôt qu'un effet.
  const designVersion = design ? `${design.id}:${design.updatedAt}` : null;
  const [syncedVersion, setSyncedVersion] = useState<string | null | undefined>(undefined);
  if (syncedVersion !== designVersion) {
    setSyncedVersion(designVersion);
    if (!design) {
      setSlides([]);
      setTheme(null);
      setSelectedPlan(null);
      setSelectedLayerId(null);
    } else {
      setSlides(design.slides.map((s) => ({ planNumber: s.planNumber, html: s.html })));
      setTheme(design.theme);
      setSelectedPlan((p) => (p !== null && design.slides.some((s) => s.planNumber === p) ? p : (design.slides[0]?.planNumber ?? null)));
    }
  }

  const urls: RenderUrls = useMemo(
    () => ({
      baseImageUrl: design && design.baseKind !== "none" ? `/api/scripts/${script.id}/design/base?v=${design.baseGeneratedImageId ?? design.baseAssetId ?? design.id}` : null,
      logoUrl: hasLogo ? `/api/scripts/${script.id}/design/logo` : null,
    }),
    [design, hasLogo, script.id]
  );

  const current = slides.find((s) => s.planNumber === selectedPlan) ?? null;
  const layerInfo = current && selectedLayerId ? describeLayer(current.html, selectedLayerId) : null;

  // --- Persistance (retouches manuelles) ---
  const scheduleSave = useCallback(
    (next: LocalSlide[]) => {
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (!dirtyRef.current) return;
        dirtyRef.current = false;
        try {
          const { design: saved } = await api.patchDesign(script.id, { slides: next });
          onDesignChange(saved);
        } catch (err) {
          setError(err instanceof ApiClientError ? err.message : "Enregistrement de la maquette impossible.");
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [script.id, onDesignChange]
  );

  function applySlides(next: LocalSlide[], options: { record?: boolean } = {}) {
    if (options.record !== false) {
      setUndoStack((u) => [...u.slice(-29), slides]);
      setRedoStack([]);
    }
    setSlides(next);
    scheduleSave(next);
  }

  function updateCurrent(html: string) {
    if (!current) return;
    applySlides(slides.map((s) => (s.planNumber === current.planNumber ? { ...s, html } : s)));
  }

  function undo() {
    const prev = undoStack[undoStack.length - 1];
    if (!prev) return;
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, slides]);
    setSlides(prev);
    scheduleSave(prev);
  }

  function redo() {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, slides]);
    setSlides(next);
    scheduleSave(next);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedLayerId && current) {
        e.preventDefault();
        updateCurrent(removeLayer(current.html, selectedLayerId));
        setSelectedLayerId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack, redoStack, slides, selectedLayerId, current]);

  // --- Création ---
  async function create(baseKind: "generated" | "asset" | "none", baseAssetId?: string) {
    setBusy("create");
    setError(null);
    try {
      const { design: created, rationale: why } = await api.createDesign(script.id, { baseKind, baseAssetId, format });
      setRationale(why);
      setUndoStack([]);
      setRedoStack([]);
      onDesignChange(created);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Composition impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function openAssetPicker() {
    setAssetPickerOpen(true);
    try {
      const { assets: list } = await api.getAssets();
      setAssets(list.filter((a) => a.status === "ready"));
    } catch {
      setAssets([]);
    }
  }

  // --- Instruction à l'agent ---
  async function sendInstruction() {
    const text = instruction.trim();
    if (!text || !design) return;
    setBusy("instruct");
    setError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirtyRef.current) {
        dirtyRef.current = false;
        await api.patchDesign(script.id, { slides });
      }
      const { design: revised, rationale: why } = await api.instructDesign(script.id, {
        instruction: text,
        planNumber: scope === "slide" ? selectedPlan : null,
      });
      setRationale(why);
      setUndoStack((u) => [...u.slice(-29), slides]);
      setRedoStack([]);
      setInstruction("");
      onDesignChange(revised);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "L'agent n'a pas pu réviser la maquette.");
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    if (!design) return;
    setConfirmRefresh(false);
    setFormat(formatIdOf(design));
    await create(design.baseKind, design.baseAssetId ?? undefined);
  }

  async function remove() {
    if (!design) return;
    setBusy("delete");
    try {
      await api.deleteDesign(script.id);
      onDesignChange(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Suppression impossible.");
    } finally {
      setBusy(null);
    }
  }

  // --- Export ---
  async function exportAll() {
    if (!design) return;
    setBusy("export");
    setError(null);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (dirtyRef.current) {
        dirtyRef.current = false;
        await api.patchDesign(script.id, { slides });
      }
      const files: { planNumber: number; blob: Blob }[] = [];
      for (const slide of slides) {
        files.push({ planNumber: slide.planNumber, blob: await renderSlideToPng(toRenderableHtml(slide.html, urls), design.width, design.height) });
      }
      const { design: exported } = await api.exportDesign(script.id, files);
      onDesignChange(exported);
      const base = (script.title ?? "post").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "post";
      if (files.length === 1) downloadBlob(files[0].blob, `${base}.png`);
      else downloadBlob(await zipBlobs(files.map((f) => ({ name: `${base}-${f.planNumber}.png`, blob: f.blob }))), `${base}.zip`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Export impossible : ${err instanceof Error ? err.message : "erreur inconnue"}.`);
    } finally {
      setBusy(null);
    }
  }

  // --- Slides ---
  function duplicateCurrent() {
    if (!current) return;
    const planNumber = nextPlanNumber(slides);
    applySlides([...slides, { planNumber, html: current.html }]);
    setSelectedPlan(planNumber);
  }

  function deleteCurrent() {
    if (!current || slides.length <= 1) return;
    const next = slides.filter((s) => s.planNumber !== current.planNumber);
    applySlides(next);
    setSelectedPlan(next[0]?.planNumber ?? null);
    setSelectedLayerId(null);
  }

  const headerTitle = (
    <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ color: "oklch(0.55 0.2 292)" }}>▧</span>Design
    </div>
  );

  if (!design) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          {headerTitle}
          <select value={format} onChange={(e) => setFormat(e.target.value as DesignFormatId)} style={selectStyle}>
            {(Object.keys(DESIGN_FORMATS) as DesignFormatId[]).map((id) => (
              <option key={id} value={id}>
                {DESIGN_FORMATS[id].label}
              </option>
            ))}
          </select>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: color.textMuted }}>
          L&apos;agent compose une slide par entrée du storyboard, que tu retouches ensuite à la main ou par instruction.
        </p>
        {script.generatedImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={script.generatedImage.url} alt="" style={{ width: 160, borderRadius: 10, display: "block", marginBottom: 12 }} />
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="secondary" disabled={busy !== null} onClick={() => (script.generatedImage ? create("generated") : onOpenStagedPhoto())}>
            {script.generatedImage ? "Depuis la photo mise en scène" : "Mettre en scène une photo d'abord"}
          </Button>
          <Button variant="secondary" disabled={busy !== null} onClick={openAssetPicker}>
            Depuis une photo de la bibliothèque
          </Button>
          <Button variant="secondary" disabled={busy !== null} onClick={() => create("none")}>
            Sans image
          </Button>
        </div>
        {busy === "create" && <p style={{ margin: "12px 0 0", fontSize: 13, color: color.textMuted }}>Composition en cours…</p>}
        {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: color.danger }}>{error}</p>}
        <Modal open={assetPickerOpen} onClose={() => setAssetPickerOpen(false)} width={640}>
          <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20, margin: "0 0 4px" }}>Choisir une photo</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: color.textMuted }}>Elle servira de fond à la maquette, telle quelle.</p>
          <AssetGrid assets={assets} selectedIds={pickedAssetId ? [pickedAssetId] : []} onToggle={(id) => setPickedAssetId((p) => (p === id ? null : id))} onDelete={() => {}} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <Button
              disabled={!pickedAssetId || busy !== null}
              onClick={() => {
                setAssetPickerOpen(false);
                if (pickedAssetId) create("asset", pickedAssetId);
              }}
            >
              Composer
            </Button>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {headerTitle}
          <span style={{ fontSize: 11, color: color.textFaint }}>
            {design.width}×{design.height} · {theme?.fontHeading} / {theme?.fontBody}
          </span>
          {design.status === "stale" && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "oklch(0.5 0.13 60)", background: "oklch(0.62 0.13 60 / 0.16)", borderRadius: 20, padding: "3px 8px" }}>
              Storyboard modifié · design à rafraîchir
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button style={iconBtn} title="Annuler (Ctrl+Z)" onClick={undo} disabled={undoStack.length === 0}>
            <Undo2 size={15} />
          </button>
          <button style={iconBtn} title="Rétablir (Ctrl+Maj+Z)" onClick={redo} disabled={redoStack.length === 0}>
            <Redo2 size={15} />
          </button>
          <button style={iconBtn} title="Recomposer avec l'agent (les retouches manuelles seront perdues)" onClick={() => setConfirmRefresh(true)} disabled={busy !== null}>
            <RefreshCw size={15} />
          </button>
          <button style={{ ...iconBtn, color: color.danger }} title="Supprimer la maquette" onClick={remove} disabled={busy !== null}>
            <Trash2 size={15} />
          </button>
          <Button onClick={exportAll} disabled={busy !== null} style={{ padding: "8px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={14} />
            {busy === "export" ? "Export…" : slides.length > 1 ? "Exporter les slides" : "Exporter"}
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `${CANVAS_WIDTH}px 1fr`, gap: 16, alignItems: "start" }}>
        <div>
          {current && (
            <DesignCanvas
              key={current.planNumber}
              html={toRenderableHtml(current.html, urls)}
              width={design.width}
              height={design.height}
              displayWidth={CANVAS_WIDTH}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onCommit={(rendered) => updateCurrent(fromRenderedHtml(rendered, urls))}
            />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", overflowX: "auto", paddingBottom: 4 }}>
            {slides.map((s) => (
              <button
                key={s.planNumber}
                onClick={() => {
                  setSelectedPlan(s.planNumber);
                  setSelectedLayerId(null);
                }}
                title={`Slide ${s.planNumber}`}
                style={{
                  flexShrink: 0,
                  width: 64,
                  height: Math.round((64 * design.height) / design.width),
                  border: s.planNumber === selectedPlan ? "2px solid oklch(0.55 0.2 292)" : `1px solid ${color.border}`,
                  borderRadius: 6,
                  overflow: "hidden",
                  position: "relative",
                  background: "#fff",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <div
                  style={{ position: "absolute", top: 0, left: 0, width: design.width, height: design.height, transform: `scale(${64 / design.width})`, transformOrigin: "top left", pointerEvents: "none" }}
                  dangerouslySetInnerHTML={{ __html: toRenderableHtml(s.html, urls) }}
                />
              </button>
            ))}
            <button style={iconBtn} title="Dupliquer la slide" onClick={duplicateCurrent} disabled={!current || slides.length >= 12}>
              <Plus size={14} />
            </button>
            {slides.length > 1 && (
              <button style={{ ...iconBtn, color: color.danger }} title="Supprimer la slide" onClick={deleteCurrent}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: color.textFaint }}>
            Clique un calque pour le sélectionner, glisse pour le déplacer, double-clique un texte pour l&apos;éditer. Suppr retire le calque.
          </p>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ border: `1px solid ${color.border}`, borderRadius: 12, padding: 14, background: color.listItemBg }}>
            {layerInfo ? (
              <LayerInspector
                layer={layerInfo}
                onStyle={(styles) => current && updateCurrent(updateLayerStyle(current.html, layerInfo.id, styles))}
                onMove={(dir) => current && updateCurrent(moveLayer(current.html, layerInfo.id, dir))}
                onDelete={() => {
                  if (current) updateCurrent(removeLayer(current.html, layerInfo.id));
                  setSelectedLayerId(null);
                }}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>Sélectionne un calque sur la slide pour le retoucher.</p>
            )}
          </div>

          <div style={{ border: `1px solid ${accentAlpha(0.25)}`, background: accentAlpha(0.06), borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, marginBottom: 6 }}>Demander à l&apos;agent</div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Titre plus gros, fond plus sombre, mets le prix en bas à droite…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") sendInstruction();
              }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <select value={scope} onChange={(e) => setScope(e.target.value as "slide" | "all")} style={selectStyle}>
                <option value="slide">Cette slide</option>
                <option value="all">Toutes les slides</option>
              </select>
              <Button onClick={sendInstruction} disabled={busy !== null || !instruction.trim()} style={{ padding: "8px 14px", fontSize: 13 }}>
                {busy === "instruct" ? "L'agent travaille…" : "Envoyer"}
              </Button>
              <span style={{ fontSize: 11, color: color.textFaint }}>Compte comme une micro-retouche.</span>
            </div>
            {rationale && <p style={{ margin: "10px 0 0", fontSize: 12, color: color.textMuted }}>{rationale}</p>}
          </div>

          {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}
          {design.containsAiImagery && (
            <p style={{ margin: 0, fontSize: 11, color: color.textFaint }}>
              Cette maquette contient une image générée par IA (photo mise en scène).
            </p>
          )}
        </div>
      </div>

      <Modal open={confirmRefresh} onClose={() => setConfirmRefresh(false)} width={440}>
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Recomposer la maquette ?</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: color.textMuted }}>
          L&apos;agent repart du storyboard actuel avec le même thème. Tes retouches manuelles sur cette maquette seront perdues.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="secondary" onClick={() => setConfirmRefresh(false)}>
            Annuler
          </Button>
          <Button onClick={refresh}>Recomposer</Button>
        </div>
      </Modal>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: color.inputBg,
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 8,
  padding: "6px 8px",
  cursor: "pointer",
  color: color.textMuted,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  background: color.cardBg,
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  border: `1px solid ${color.inputBorder}`,
  borderRadius: 8,
  padding: "6px 8px",
  fontSize: 12,
  fontFamily: "inherit",
  background: color.cardBg,
};

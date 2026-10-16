"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ImagePlus, Plus, Redo2, RefreshCw, Shapes, Trash2, Undo2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import AssetGrid from "@/components/BrandAssetLibrary/AssetGrid";
import { api, ApiClientError, type BrandAsset, type DesignImageVariant, type DesignTheme, type Script, type TimelineEntry, type VisualDesign } from "@/lib/apiClient";
import { accentAlpha, color, fontHeading } from "@/lib/design/tokens";
import { DESIGN_FORMATS, defaultFormatForPlatform, type DesignFormatId } from "@/lib/visualDesign/formats";
import { MAX_DESIGN_IMAGES } from "@/lib/visualDesign/designImages";
import { UI_ELEMENTS } from "@/lib/visualDesign/uiElements";
import DesignCanvas from "./DesignCanvas";
import LayerInspector from "./LayerInspector";
import {
  appendLayer,
  buildImageLayerHtml,
  describeLayer,
  fromRenderedHtml,
  moveLayer,
  nextPlanNumber,
  removeLayer,
  setLayerImageRef,
  toRenderableHtml,
  updateLayerImageStyle,
  updateLayerStyle,
  type RenderUrls,
} from "./designDom";
import { downloadBlob, renderSlideToPng, zipBlobs } from "./exportSlides";
import { renderAnimationToMp4 } from "./exportAnimation";
import TimelineBar from "./TimelineBar";

type LocalSlide = { planNumber: number; html: string };
/** Ce que l'undo/redo restaure : les slides et, pour une animation, la ligne de temps. */
type Snapshot = { slides: LocalSlide[]; timeline: TimelineEntry[] | null };

const CANVAS_WIDTH = 520;
const SAVE_DEBOUNCE_MS = 800;
/** Composition automatique après génération (docs/SPEC_COMPOSITION_VISUELLE.md §6) : relecture et abandon. */
const AUTO_COMPOSE_POLL_MS = 3000;
const AUTO_COMPOSE_WINDOW_MS = 2 * 60 * 1000;
const AUTO_COMPOSE_GIVE_UP_MS = 60 * 1000;

function formatIdOf(design: VisualDesign): DesignFormatId {
  const found = (Object.keys(DESIGN_FORMATS) as DesignFormatId[]).find((id) => DESIGN_FORMATS[id].width === design.width && DESIGN_FORMATS[id].height === design.height);
  return found ?? "square";
}

/**
 * Section « Design » de l'éditeur d'un post visuel (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §3, §6 ;
 * docs/SPEC_COMPOSITION_VISUELLE.md §3, §6). Deux modes : sans maquette → composition automatique
 * en cours, ou choix des photos et création par l'agent ; avec maquette → canevas éditable à la
 * main, inspecteur, photos et éléments ajoutés à la main, instruction à l'agent, export.
 */
export default function DesignEditor({
  script,
  hasLogo,
  onDesignChange,
  onReload,
}: {
  script: Script;
  hasLogo: boolean;
  onDesignChange: (design: VisualDesign | null) => void;
  /** Recharge la fiche (composition automatique en arrière-plan juste après la génération). */
  onReload: () => Promise<void>;
}) {
  const design = script.visualDesign ?? null;
  const [slides, setSlides] = useState<LocalSlide[]>([]);
  const [theme, setTheme] = useState<DesignTheme | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [playheadMs, setPlayheadMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const exportAbort = useRef<AbortController | null>(null);
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [instruction, setInstruction] = useState("");
  const [scope, setScope] = useState<"slide" | "all">("slide");
  const [busy, setBusy] = useState<string | null>(null);
  const [cutoutBusyRef, setCutoutBusyRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rationale, setRationale] = useState<string | null>(null);
  const [format, setFormat] = useState<DesignFormatId>(defaultFormatForPlatform(script.platform));
  // Sélecteur de photos : "create" (composition), "change" (recomposition), "add" (ajout sans recomposer).
  const [picker, setPicker] = useState<"create" | "change" | "add" | null>(null);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [elementsOpen, setElementsOpen] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [autoWaitGaveUp, setAutoWaitGaveUp] = useState(false);
  // Évalué une fois au montage (pas à chaque rendu) : le script vient-il d'être généré ?
  const [recentlyGenerated] = useState(() => script.origin === "generated" && Date.now() - new Date(script.createdAt).getTime() < AUTO_COMPOSE_WINDOW_MS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  // Sauvegarde différée déjà partie (PATCH en vol) : attendue par flushPendingSave avant toute
  // autre écriture, sinon deux read-modify-write se croisent côté serveur.
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  // Jeton de version : incrémenté à chaque nouvelle version de la maquette venue du serveur. Une
  // sauvegarde différée armée avant un tel changement ne doit ni partir ni s'appliquer — sinon elle
  // repousserait un HTML antérieur à une révision de l'agent (course signalée en revue).
  const generationRef = useRef(0);

  // Resynchronise l'état local quand la maquette change de version (création, instruction,
  // recomposition) — ajustement d'état pendant le rendu, pattern React « adjusting state when a
  // prop changes », plutôt qu'un effet.
  const designVersion = design ? `${design.id}:${design.updatedAt}` : null;
  const [syncedVersion, setSyncedVersion] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    // Toute nouvelle version venue du serveur périme la sauvegarde différée en attente.
    generationRef.current += 1;
    dirtyRef.current = false;
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, [designVersion]);
  if (syncedVersion !== designVersion) {
    setSyncedVersion(designVersion);
    if (!design) {
      setSlides([]);
      setTheme(null);
      setTimeline(null);
      setDurationMs(null);
      setPlaying(false);
      setSelectedPlan(null);
      setSelectedLayerId(null);
    } else {
      setSlides(design.slides.map((s) => ({ planNumber: s.planNumber, html: s.html })));
      setTheme(design.theme);
      setTimeline(design.durationMs ? (design.timeline ?? []) : null);
      setDurationMs(design.durationMs ?? null);
      setPlaying(false);
      setSelectedPlan((p) => (p !== null && design.slides.some((s) => s.planNumber === p) ? p : (design.slides[0]?.planNumber ?? null)));
    }
  }

  // Composition automatique (docs/SPEC_COMPOSITION_VISUELLE.md §2) : un script généré il y a moins
  // de deux minutes et sans maquette est probablement en cours de composition côté serveur — on
  // relit la fiche toutes les 3 s, puis on rend la main aux boutons au bout d'une minute.
  const autoComposing = !design && !autoWaitGaveUp && recentlyGenerated;
  useEffect(() => {
    if (!autoComposing) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > AUTO_COMPOSE_GIVE_UP_MS) {
        clearInterval(timer);
        setAutoWaitGaveUp(true);
        return;
      }
      onReload().catch(() => {});
    }, AUTO_COMPOSE_POLL_MS);
    return () => clearInterval(timer);
  }, [autoComposing, onReload]);

  const urls: RenderUrls = useMemo(
    () => ({
      images: Object.fromEntries(
        (design?.images ?? []).map((img) => [img.ref, `/api/scripts/${script.id}/design/images/${img.ref}?v=${img.assetId}:${img.variant}`])
      ),
      logoUrl: hasLogo ? `/api/scripts/${script.id}/design/logo` : null,
    }),
    [design, hasLogo, script.id]
  );

  const current = slides.find((s) => s.planNumber === selectedPlan) ?? null;
  const layerInfo = current && selectedLayerId ? describeLayer(current.html, selectedLayerId) : null;
  const isAnimation = durationMs !== null && timeline !== null;

  // --- Persistance (retouches manuelles) ---
  const scheduleSave = useCallback(
    (next: Snapshot, nextDurationMs?: number | null) => {
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const generation = generationRef.current;
      saveTimer.current = setTimeout(() => {
        if (!dirtyRef.current || generation !== generationRef.current) return;
        dirtyRef.current = false;
        const job = (async () => {
          try {
            const { design: saved } = await api.patchDesign(script.id, {
              slides: next.slides,
              ...(next.timeline ? { timeline: next.timeline } : {}),
              ...(nextDurationMs ? { durationMs: nextDurationMs } : {}),
            });
            // Une version plus récente (instruction, recomposition) est arrivée entre-temps : la
            // réponse de cette sauvegarde est périmée, on ne l'applique pas.
            if (generation !== generationRef.current) return;
            onDesignChange(saved);
          } catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Enregistrement de la maquette impossible.");
          }
        })().finally(() => {
          if (inFlightSaveRef.current === job) inFlightSaveRef.current = null;
        });
        inFlightSaveRef.current = job;
      }, SAVE_DEBOUNCE_MS);
    },
    [script.id, onDesignChange]
  );

  /** Envoie tout de suite les retouches en attente (avant une instruction, un export, une bascule de photo). */
  async function flushPendingSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (inFlightSaveRef.current) await inFlightSaveRef.current;
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    await api.patchDesign(script.id, { slides, ...(timeline ? { timeline } : {}), ...(durationMs ? { durationMs } : {}) });
  }

  function applySnapshot(next: Snapshot, options: { record?: boolean } = {}) {
    if (busy !== null) return;
    if (options.record !== false) {
      setUndoStack((u) => [...u.slice(-29), { slides, timeline }]);
      setRedoStack([]);
    }
    setSlides(next.slides);
    setTimeline(next.timeline);
    scheduleSave(next);
  }

  function applySlides(next: LocalSlide[], options: { record?: boolean } = {}) {
    // Un calque supprimé quitte aussi la ligne de temps.
    const layerIds = new Set(next.flatMap((s) => Array.from(s.html.matchAll(/data-layer="([^"]+)"/g)).map((m) => m[1])));
    const nextTimeline = timeline ? timeline.filter((t) => layerIds.has(t.layerId)) : null;
    applySnapshot({ slides: next, timeline: nextTimeline }, options);
  }

  function updateCurrent(html: string) {
    if (!current) return;
    applySlides(slides.map((s) => (s.planNumber === current.planNumber ? { ...s, html } : s)));
  }

  function updateTimelineEntry(layerId: string, entry: TimelineEntry | null) {
    if (!timeline) return;
    const rest = timeline.filter((t) => t.layerId !== layerId);
    applySnapshot({ slides, timeline: entry ? [...rest, entry].sort((a, b) => a.startMs - b.startMs) : rest });
  }

  function changeDuration(next: number) {
    if (!timeline || busy !== null) return;
    setDurationMs(next);
    setPlayheadMs((p) => Math.min(p, next));
    // Les instants au-delà de la nouvelle durée sont ramenés dedans (le serveur ferait pareil).
    // Même invariant que normalizeTimeline côté serveur : la sortie reste strictement après la fin
    // de l'entrée, sinon la sauvegarde partirait en 422.
    const clamped = timeline.map((t) => {
      const startMs = Math.min(t.startMs, Math.max(0, next - t.enterMs));
      const exitAtMs = t.exit && t.exitAtMs !== null ? Math.max(startMs + t.enterMs + 1, Math.min(t.exitAtMs, next)) : null;
      return { ...t, startMs, exitAtMs, exit: exitAtMs === null ? null : t.exit };
    });
    setTimeline(clamped);
    scheduleSave({ slides, timeline: clamped }, next);
  }

  function undo() {
    const prev = undoStack[undoStack.length - 1];
    if (!prev || busy !== null) return;
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, { slides, timeline }]);
    setSlides(prev.slides);
    setTimeline(prev.timeline);
    scheduleSave(prev);
  }

  function redo() {
    const next = redoStack[redoStack.length - 1];
    if (!next || busy !== null) return;
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, { slides, timeline }]);
    setSlides(next.slides);
    setTimeline(next.timeline);
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
  }, [undoStack, redoStack, slides, selectedLayerId, current, busy]);

  // --- Création / recomposition ---
  async function create(assetIds: string[]) {
    setBusy("create");
    setError(null);
    try {
      const { design: created, rationale: why } = await api.createDesign(script.id, { assetIds, format });
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

  async function openPicker(mode: "create" | "change" | "add") {
    setPicker(mode);
    // Présélection : les photos de la maquette courante, ou la photo trouvée à la génération.
    setPickedIds(mode === "change" && design ? design.images.map((i) => i.assetId) : mode === "create" && script.brandAssetId ? [script.brandAssetId] : []);
    try {
      const { assets: list } = await api.getAssets();
      setAssets(list.filter((a) => a.status === "ready"));
    } catch {
      setAssets([]);
    }
  }

  function togglePicked(id: string) {
    setPickedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_DESIGN_IMAGES ? prev : [...prev, id]));
  }

  async function confirmPicker() {
    const mode = picker;
    const ids = pickedIds;
    setPicker(null);
    if (mode === "create") await create(ids);
    else if (mode === "change") {
      setFormat(design ? formatIdOf(design) : format);
      await create(ids);
    } else if (mode === "add") await addPhoto(ids[0]);
  }

  /** Ajoute une photo à la maquette et pose un calque image centré (§6 « Ajouter une photo »). */
  async function addPhoto(assetId: string | undefined) {
    if (!assetId || !design || !current) return;
    setBusy("add");
    setError(null);
    try {
      await flushPendingSave();
      const existing = design.images.find((i) => i.assetId === assetId);
      let ref = existing?.ref ?? null;
      let next: VisualDesign = design;
      if (!ref) {
        const res = await api.addDesignImage(script.id, assetId);
        next = res.design;
        ref = res.ref;
      }
      const { html } = appendLayer(current.html, buildImageLayerHtml(ref, { width: design.width, height: design.height }));
      const nextSlides = slides.map((s) => (s.planNumber === current.planNumber ? { ...s, html } : s));
      const { design: saved } = await api.patchDesign(script.id, { slides: nextSlides, ...(timeline ? { timeline } : {}) });
      setUndoStack((u) => [...u.slice(-29), { slides, timeline }]);
      setRedoStack([]);
      onDesignChange({ ...next, ...saved });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Ajout de la photo impossible.");
    } finally {
      setBusy(null);
    }
  }

  /** Insère un élément du catalogue sur la slide courante (§6 « Ajouter un élément »). */
  function addElement(id: string) {
    setElementsOpen(false);
    if (!design || !current || !theme) return;
    const element = UI_ELEMENTS.find((e) => e.id === id);
    if (!element) return;
    const { html, layerId } = appendLayer(current.html, element.html(theme, { width: design.width, height: design.height }));
    updateCurrent(html);
    setSelectedLayerId(layerId || null);
  }

  /** Bascule original / détouré d'une photo (toutes les slides qui l'affichent). */
  async function setVariant(ref: string, variant: DesignImageVariant) {
    if (!design) return;
    const image = design.images.find((i) => i.ref === ref);
    if (!image || image.variant === variant) return;
    setCutoutBusyRef(ref);
    // Le canevas est gelé pendant la bascule (un détourage peut prendre plusieurs secondes) : une
    // retouche faite entre-temps entrerait en course avec la réponse.
    setBusy("variant");
    setError(null);
    try {
      await flushPendingSave();
      const images = design.images.map((i) => ({ ref: i.ref, assetId: i.assetId, variant: i.ref === ref ? variant : i.variant }));
      const { design: saved } = await api.patchDesign(script.id, { images });
      const applied = saved.images.find((i) => i.ref === ref);
      if (variant === "cutout" && applied?.variant !== "cutout") setError("Le détourage n'a pas abouti : la photo reste entière.");
      onDesignChange(saved);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Changement de variante impossible.");
    } finally {
      setCutoutBusyRef(null);
      setBusy(null);
    }
  }

  // --- Instruction à l'agent ---
  async function sendInstruction() {
    const text = instruction.trim();
    if (!text || !design) return;
    setBusy("instruct");
    setError(null);
    try {
      await flushPendingSave();
      const { design: revised, rationale: why } = await api.instructDesign(script.id, {
        instruction: text,
        planNumber: scope === "slide" ? selectedPlan : null,
      });
      setRationale(why);
      setUndoStack((u) => [...u.slice(-29), { slides, timeline }]);
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
    await create(design.images.map((i) => i.assetId));
  }

  async function remove() {
    if (!design) return;
    setBusy("delete");
    try {
      await api.deleteDesign(script.id);
      setAutoWaitGaveUp(true);
      onDesignChange(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Suppression impossible.");
    } finally {
      setBusy(null);
    }
  }

  // --- Export (PNG, ou MP4 pour une animation — uniquement sur le bouton) ---
  async function exportAll() {
    if (!design) return;
    setPlaying(false);
    setBusy("export");
    setError(null);
    setExportProgress(null);
    try {
      await flushPendingSave();
      const base = (script.title ?? "post").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "post";
      if (isAnimation && timeline && durationMs && slides[0]) {
        const controller = new AbortController();
        exportAbort.current = controller;
        const blob = await renderAnimationToMp4({
          renderableHtml: toRenderableHtml(slides[0].html, urls),
          width: design.width,
          height: design.height,
          durationMs,
          timeline,
          signal: controller.signal,
          onProgress: (done, total) => setExportProgress({ done, total }),
        });
        const { design: exported } = await api.exportDesign(script.id, [{ planNumber: slides[0].planNumber, blob }]);
        onDesignChange(exported);
        downloadBlob(blob, `${base}.mp4`);
        return;
      }
      const files: { planNumber: number; blob: Blob }[] = [];
      for (const slide of slides) {
        files.push({ planNumber: slide.planNumber, blob: await renderSlideToPng(toRenderableHtml(slide.html, urls), design.width, design.height) });
      }
      const { design: exported } = await api.exportDesign(script.id, files);
      onDesignChange(exported);
      if (files.length === 1) downloadBlob(files[0].blob, `${base}.png`);
      else downloadBlob(await zipBlobs(files.map((f) => ({ name: `${base}-${f.planNumber}.png`, blob: f.blob }))), `${base}.zip`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Export impossible : ${err instanceof Error ? err.message : "erreur inconnue"}.`);
    } finally {
      exportAbort.current = null;
      setExportProgress(null);
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

  const pickerModal = (
    <Modal open={picker !== null} onClose={() => setPicker(null)} width={640}>
      <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20, margin: "0 0 4px" }}>
        {picker === "add" ? "Ajouter une photo" : "Choisir des photos"}
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: color.textMuted }}>
        {picker === "add"
          ? "Elle sera posée sur la slide courante, à déplacer ensuite."
          : `Jusqu'à ${MAX_DESIGN_IMAGES} photos de ta bibliothèque. L'agent décide lesquelles utiliser, entières ou détourées, et comment les monter.`}
      </p>
      <AssetGrid assets={assets} selectedIds={pickedIds} onToggle={picker === "add" ? (id) => setPickedIds([id]) : togglePicked} onDelete={() => {}} maxSelected={picker === "add" ? 1 : MAX_DESIGN_IMAGES} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 8 }}>
        <span style={{ fontSize: 12, color: color.textFaint }}>
          {picker === "add" ? "" : `${pickedIds.length}/${MAX_DESIGN_IMAGES} sélectionnée${pickedIds.length > 1 ? "s" : ""}`}
        </span>
        <Button disabled={busy !== null || (picker === "add" && pickedIds.length === 0)} onClick={confirmPicker}>
          {picker === "add" ? "Ajouter" : picker === "change" ? "Recomposer" : pickedIds.length === 0 ? "Composer sans photo" : "Composer"}
        </Button>
      </div>
    </Modal>
  );

  if (!design) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
          {headerTitle}
          {!autoComposing && (
            <select value={format} onChange={(e) => setFormat(e.target.value as DesignFormatId)} style={selectStyle}>
              {(Object.keys(DESIGN_FORMATS) as DesignFormatId[]).map((id) => (
                <option key={id} value={id}>
                  {DESIGN_FORMATS[id].label}
                </option>
              ))}
            </select>
          )}
        </div>
        {autoComposing && busy === null ? (
          <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
            Composition en cours… L&apos;agent assemble le visuel à partir de tes photos. Il apparaîtra ici dans quelques secondes.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: color.textMuted }}>
              L&apos;agent compose une slide par entrée du storyboard à partir de tes vraies photos (montage, produit détouré, éléments
              d&apos;interface), que tu retouches ensuite à la main ou par instruction.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button disabled={busy !== null} onClick={() => openPicker("create")}>
                Choisir des photos
              </Button>
              <Button variant="secondary" disabled={busy !== null} onClick={() => create([])}>
                Sans photo
              </Button>
            </div>
          </>
        )}
        {busy === "create" && <p style={{ margin: "12px 0 0", fontSize: 13, color: color.textMuted }}>Composition en cours…</p>}
        {error && <p style={{ margin: "12px 0 0", fontSize: 13, color: color.danger }}>{error}</p>}
        {pickerModal}
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
          {busy === "export" && exportProgress && (
            <button style={iconBtn} title="Annuler l'export" onClick={() => exportAbort.current?.abort()}>
              {Math.round((exportProgress.done / exportProgress.total) * 100)} % · annuler
            </button>
          )}
          <Button onClick={exportAll} disabled={busy !== null} style={{ padding: "8px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={14} />
            {busy === "export" ? "Export…" : isAnimation ? "Exporter la vidéo" : slides.length > 1 ? "Exporter les slides" : "Exporter"}
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
              readOnly={busy !== null}
              timeline={isAnimation ? timeline : null}
              durationMs={durationMs}
              playheadMs={playheadMs}
              playing={playing}
              onPlayheadChange={setPlayheadMs}
            />
          )}
          {isAnimation && durationMs && (
            <TimelineBar
              durationMs={durationMs}
              playheadMs={playheadMs}
              playing={playing}
              disabled={busy !== null}
              onPlayingChange={setPlaying}
              onSeek={setPlayheadMs}
              onDurationChange={changeDuration}
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
            <button style={iconBtn} title="Dupliquer la slide" onClick={duplicateCurrent} disabled={!current || slides.length >= 12 || isAnimation}>
              <Plus size={14} />
            </button>
            {slides.length > 1 && !isAnimation && (
              <button style={{ ...iconBtn, color: color.danger }} title="Supprimer la slide" onClick={deleteCurrent}>
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Photos de la maquette et actions d'ajout (docs/SPEC_COMPOSITION_VISUELLE.md §6). */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            {design.images.map((img) => (
              <div
                key={img.ref}
                title={`${img.ref} · ${img.variant === "cutout" ? "détourée" : "entière"}`}
                style={{ width: 34, height: 34, borderRadius: 6, overflow: "hidden", border: `1px solid ${color.border}`, position: "relative", background: color.trackBg }}
              >
                {img.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <span style={{ position: "absolute", inset: "auto 0 0 0", fontSize: 9, fontWeight: 700, textAlign: "center", background: "rgba(255,255,255,0.85)" }}>
                  {img.ref}
                  {img.variant === "cutout" ? "✂" : ""}
                </span>
              </div>
            ))}
            <button style={{ ...iconBtn, gap: 6, fontSize: 12 }} title="Ajouter une photo de la bibliothèque sur cette slide" onClick={() => openPicker("add")} disabled={busy !== null}>
              <ImagePlus size={14} /> Ajouter une photo
            </button>
            <div style={{ position: "relative" }}>
              <button style={{ ...iconBtn, gap: 6, fontSize: 12 }} title="Étiquette de prix, badge, bouton, cadre…" onClick={() => setElementsOpen((o) => !o)} disabled={busy !== null}>
                <Shapes size={14} /> Ajouter un élément
              </button>
              {elementsOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 10, marginTop: 4, background: color.cardBg, border: `1px solid ${color.border}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 6, display: "grid", minWidth: 200 }}>
                  {UI_ELEMENTS.map((e) => (
                    <button key={e.id} onClick={() => addElement(e.id)} style={{ ...menuItem }}>
                      {e.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button style={{ ...iconBtn, fontSize: 12 }} title="Choisir d'autres photos et recomposer" onClick={() => openPicker("change")} disabled={busy !== null}>
              Changer les photos
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: color.textFaint }}>
            Clique un calque pour le sélectionner, glisse pour le déplacer, double-clique un texte pour l&apos;éditer. Suppr retire le calque.
          </p>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ border: `1px solid ${color.border}`, borderRadius: 12, padding: 14, background: color.listItemBg }}>
            {busy !== null ? (
              <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
                {busy === "instruct" ? "L'agent révise la maquette…" : busy === "export" ? "Export en cours…" : busy === "add" ? "Ajout de la photo…" : busy === "variant" ? "Changement de variante (détourage si besoin)…" : "Composition en cours…"} Les retouches manuelles reprendront ensuite.
              </p>
            ) : layerInfo ? (
              <LayerInspector
                layer={layerInfo}
                onStyle={(styles) => current && updateCurrent(updateLayerStyle(current.html, layerInfo.id, styles))}
                onMove={(dir) => current && updateCurrent(moveLayer(current.html, layerInfo.id, dir))}
                onDelete={() => {
                  if (current) updateCurrent(removeLayer(current.html, layerInfo.id));
                  setSelectedLayerId(null);
                }}
                image={
                  layerInfo.type === "image" && layerInfo.imageRef
                    ? {
                        images: design.images,
                        cutoutAvailable: design.cutoutAvailable,
                        busyRef: cutoutBusyRef,
                        onVariant: setVariant,
                        onReplace: (ref) => current && updateCurrent(setLayerImageRef(current.html, layerInfo.id, ref)),
                        onImageStyle: (styles) => current && updateCurrent(updateLayerImageStyle(current.html, layerInfo.id, styles)),
                      }
                    : undefined
                }
                animation={
                  isAnimation && durationMs
                    ? { entry: timeline?.find((t) => t.layerId === layerInfo.id) ?? null, durationMs, onChange: (entry) => updateTimelineEntry(layerInfo.id, entry) }
                    : undefined
                }
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
              placeholder="Titre plus gros, détoure le produit sur un fond uni, mets le prix en bas à droite, ajoute la deuxième photo en médaillon…"
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
        </div>
      </div>

      {pickerModal}

      <Modal open={confirmRefresh} onClose={() => setConfirmRefresh(false)} width={440}>
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Recomposer la maquette ?</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: color.textMuted }}>
          L&apos;agent repart du storyboard actuel avec les mêmes photos. Tes retouches manuelles sur cette maquette seront perdues.
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

const menuItem: React.CSSProperties = {
  background: "transparent",
  border: "none",
  textAlign: "left",
  padding: "7px 10px",
  fontSize: 13,
  fontFamily: "inherit",
  color: color.text,
  cursor: "pointer",
  borderRadius: 6,
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

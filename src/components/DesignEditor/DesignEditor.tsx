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
/** What undo/redo restores: the slides and, for an animation, the timeline. */
type Snapshot = { slides: LocalSlide[]; timeline: TimelineEntry[] | null };

const CANVAS_WIDTH = 520;
const SAVE_DEBOUNCE_MS = 800;
/** Automatic composition after generation (docs/SPEC_COMPOSITION_VISUELLE.md §6): polling and giving up. */
const AUTO_COMPOSE_POLL_MS = 3000;
const AUTO_COMPOSE_WINDOW_MS = 2 * 60 * 1000;
const AUTO_COMPOSE_GIVE_UP_MS = 60 * 1000;

function formatIdOf(design: VisualDesign): DesignFormatId {
  const found = (Object.keys(DESIGN_FORMATS) as DesignFormatId[]).find((id) => DESIGN_FORMATS[id].width === design.width && DESIGN_FORMATS[id].height === design.height);
  return found ?? "square";
}

/**
 * "Design" section of the visual post editor (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §3, §6;
 * docs/SPEC_COMPOSITION_VISUELLE.md §3, §6). Two modes: without a mockup → automatic composition
 * in progress, or photo selection and creation by the agent; with a mockup → canvas editable by
 * hand, inspector, photos and elements added by hand, instruction to the agent, export.
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
  /** Reloads the page (automatic composition in the background right after generation). */
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
  // Photo picker: "create" (composition), "change" (recomposition), "add" (add without recomposing).
  const [picker, setPicker] = useState<"create" | "change" | "add" | null>(null);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [elementsOpen, setElementsOpen] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [autoWaitGaveUp, setAutoWaitGaveUp] = useState(false);
  // Evaluated once at mount (not on every render): was the script just generated?
  const [recentlyGenerated] = useState(() => script.origin === "generated" && Date.now() - new Date(script.createdAt).getTime() < AUTO_COMPOSE_WINDOW_MS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  // Deferred save already sent (PATCH in flight): awaited by flushPendingSave before any
  // other write, otherwise two read-modify-writes cross on the server.
  const inFlightSaveRef = useRef<Promise<void> | null>(null);
  // Version token: incremented on every new version of the mockup coming from the server. A
  // deferred save armed before such a change must neither fire nor apply — otherwise it
  // would push back HTML older than an agent revision (race flagged in review).
  const generationRef = useRef(0);

  // Resyncs local state when the mockup changes version (creation, instruction,
  // recomposition) — state adjustment during render, the React pattern "adjusting state when a
  // prop changes", rather than an effect.
  const designVersion = design ? `${design.id}:${design.updatedAt}` : null;
  const [syncedVersion, setSyncedVersion] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    // Any new version coming from the server invalidates the pending deferred save.
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

  // Automatic composition (docs/SPEC_COMPOSITION_VISUELLE.md §2): a script generated less
  // than two minutes ago and without a mockup is probably being composed on the server — we
  // reload the page every 3 s, then hand control back to the buttons after a minute.
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

  // --- Persistence (manual edits) ---
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
            // A newer version (instruction, recomposition) arrived in the meantime: the
            // response of this save is stale, we don't apply it.
            if (generation !== generationRef.current) return;
            onDesignChange(saved);
          } catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Couldn't save the mockup.");
          }
        })().finally(() => {
          if (inFlightSaveRef.current === job) inFlightSaveRef.current = null;
        });
        inFlightSaveRef.current = job;
      }, SAVE_DEBOUNCE_MS);
    },
    [script.id, onDesignChange]
  );

  /** Sends pending edits right away (before an instruction, an export, a photo switch). */
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
    // A deleted layer also leaves the timeline.
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
    // Times beyond the new duration are brought back inside (the server would do the same).
    // Same invariant as normalizeTimeline on the server: the exit stays strictly after the end
    // of the entrance, otherwise the save would fail with a 422.
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

  // --- Creation / recomposition ---
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
      setError(err instanceof ApiClientError ? err.message : "Couldn't compose the mockup.");
    } finally {
      setBusy(null);
    }
  }

  async function openPicker(mode: "create" | "change" | "add") {
    setPicker(mode);
    // Preselection: the photos of the current mockup, or the photo found at generation.
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

  /** Adds a photo to the mockup and places a centered image layer (§6 "Add a photo"). */
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
      setError(err instanceof ApiClientError ? err.message : "Couldn't add the photo.");
    } finally {
      setBusy(null);
    }
  }

  /** Inserts a catalogue element on the current slide (§6 "Add an element"). */
  function addElement(id: string) {
    setElementsOpen(false);
    if (!design || !current || !theme) return;
    const element = UI_ELEMENTS.find((e) => e.id === id);
    if (!element) return;
    const { html, layerId } = appendLayer(current.html, element.html(theme, { width: design.width, height: design.height }));
    updateCurrent(html);
    setSelectedLayerId(layerId || null);
  }

  /** Toggles a photo between original / cutout (all the slides that display it). */
  async function setVariant(ref: string, variant: DesignImageVariant) {
    if (!design) return;
    const image = design.images.find((i) => i.ref === ref);
    if (!image || image.variant === variant) return;
    setCutoutBusyRef(ref);
    // The canvas is frozen during the switch (a cutout can take several seconds): an
    // edit made in the meantime would race with the response.
    setBusy("variant");
    setError(null);
    try {
      await flushPendingSave();
      const images = design.images.map((i) => ({ ref: i.ref, assetId: i.assetId, variant: i.ref === ref ? variant : i.variant }));
      const { design: saved } = await api.patchDesign(script.id, { images });
      const applied = saved.images.find((i) => i.ref === ref);
      if (variant === "cutout" && applied?.variant !== "cutout") setError("The cutout didn't work out: the photo stays as is.");
      onDesignChange(saved);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't switch the variant.");
    } finally {
      setCutoutBusyRef(null);
      setBusy(null);
    }
  }

  // --- Instruction to the agent ---
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
      setError(err instanceof ApiClientError ? err.message : "The agent couldn't revise the mockup.");
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
      setError(err instanceof ApiClientError ? err.message : "Couldn't delete.");
    } finally {
      setBusy(null);
    }
  }

  // --- Export (PNG, or MP4 for an animation — on button press only) ---
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
      setError(err instanceof ApiClientError ? err.message : `Couldn't export: ${err instanceof Error ? err.message : "unknown error"}.`);
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
        {picker === "add" ? "Add a photo" : "Choose photos"}
      </h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: color.textMuted }}>
        {picker === "add"
          ? "It will be placed on the current slide, then you can move it."
          : `Up to ${MAX_DESIGN_IMAGES} photos from your library. The agent decides which to use, whole or cut out, and how to combine them.`}
      </p>
      <AssetGrid assets={assets} selectedIds={pickedIds} onToggle={picker === "add" ? (id) => setPickedIds([id]) : togglePicked} onDelete={() => {}} maxSelected={picker === "add" ? 1 : MAX_DESIGN_IMAGES} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 8 }}>
        <span style={{ fontSize: 12, color: color.textFaint }}>
          {picker === "add" ? "" : `${pickedIds.length}/${MAX_DESIGN_IMAGES} selected`}
        </span>
        <Button disabled={busy !== null || (picker === "add" && pickedIds.length === 0)} onClick={confirmPicker}>
          {picker === "add" ? "Add" : picker === "change" ? "Recompose" : pickedIds.length === 0 ? "Compose without photos" : "Compose"}
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
            Composing… The agent is assembling the visual from your photos. It will appear here in a few seconds.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: color.textMuted }}>
              The agent composes one slide per storyboard entry from your real photos (montage, cut-out product, interface
              elements), which you then touch up by hand or by instruction.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button disabled={busy !== null} onClick={() => openPicker("create")}>
                Choose photos
              </Button>
              <Button variant="secondary" disabled={busy !== null} onClick={() => create([])}>
                No photos
              </Button>
            </div>
          </>
        )}
        {busy === "create" && <p style={{ margin: "12px 0 0", fontSize: 13, color: color.textMuted }}>Composing…</p>}
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
              Storyboard changed · design needs refreshing
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button style={iconBtn} title="Undo (Ctrl+Z)" onClick={undo} disabled={undoStack.length === 0}>
            <Undo2 size={15} />
          </button>
          <button style={iconBtn} title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={redoStack.length === 0}>
            <Redo2 size={15} />
          </button>
          <button style={iconBtn} title="Recompose with the agent (manual edits will be lost)" onClick={() => setConfirmRefresh(true)} disabled={busy !== null}>
            <RefreshCw size={15} />
          </button>
          <button style={{ ...iconBtn, color: color.danger }} title="Delete the mockup" onClick={remove} disabled={busy !== null}>
            <Trash2 size={15} />
          </button>
          {busy === "export" && exportProgress && (
            <button style={iconBtn} title="Cancel export" onClick={() => exportAbort.current?.abort()}>
              {Math.round((exportProgress.done / exportProgress.total) * 100)} % · cancel
            </button>
          )}
          <Button onClick={exportAll} disabled={busy !== null} style={{ padding: "8px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={14} />
            {busy === "export" ? "Exporting…" : isAnimation ? "Export video" : slides.length > 1 ? "Export slides" : "Export"}
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
            <button style={iconBtn} title="Duplicate slide" onClick={duplicateCurrent} disabled={!current || slides.length >= 12 || isAnimation}>
              <Plus size={14} />
            </button>
            {slides.length > 1 && !isAnimation && (
              <button style={{ ...iconBtn, color: color.danger }} title="Delete slide" onClick={deleteCurrent}>
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Mockup photos and add actions (docs/SPEC_COMPOSITION_VISUELLE.md §6). */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            {design.images.map((img) => (
              <div
                key={img.ref}
                title={`${img.ref} · ${img.variant === "cutout" ? "cutout" : "original"}`}
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
            <button style={{ ...iconBtn, gap: 6, fontSize: 12 }} title="Add a photo from the library to this slide" onClick={() => openPicker("add")} disabled={busy !== null}>
              <ImagePlus size={14} /> Add a photo
            </button>
            <div style={{ position: "relative" }}>
              <button style={{ ...iconBtn, gap: 6, fontSize: 12 }} title="Price tag, badge, button, frame…" onClick={() => setElementsOpen((o) => !o)} disabled={busy !== null}>
                <Shapes size={14} /> Add an element
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
            <button style={{ ...iconBtn, fontSize: 12 }} title="Choose other photos and recompose" onClick={() => openPicker("change")} disabled={busy !== null}>
              Change photos
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: color.textFaint }}>
            Click a layer to select it, drag to move it, double-click a text to edit it. Delete removes the layer.
          </p>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ border: `1px solid ${color.border}`, borderRadius: 12, padding: 14, background: color.listItemBg }}>
            {busy !== null ? (
              <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
                {busy === "instruct" ? "The agent is revising the mockup…" : busy === "export" ? "Exporting…" : busy === "add" ? "Adding the photo…" : busy === "variant" ? "Switching variant (cutting out if needed)…" : "Composing…"} Les retouches manuelles reprendront ensuite.
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
              <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>Select a layer on the slide to edit it.</p>
            )}
          </div>

          <div style={{ border: `1px solid ${accentAlpha(0.25)}`, background: accentAlpha(0.06), borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, marginBottom: 6 }}>Ask the agent</div>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Bigger title, cut out the product on a plain background, put the price at the bottom right, add the second photo as a medallion…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") sendInstruction();
              }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              <select value={scope} onChange={(e) => setScope(e.target.value as "slide" | "all")} style={selectStyle}>
                <option value="slide">This slide</option>
                <option value="all">All slides</option>
              </select>
              <Button onClick={sendInstruction} disabled={busy !== null || !instruction.trim()} style={{ padding: "8px 14px", fontSize: 13 }}>
                {busy === "instruct" ? "The agent is working…" : "Send"}
              </Button>
              <span style={{ fontSize: 11, color: color.textFaint }}>Counts as a micro-edit.</span>
            </div>
            {rationale && <p style={{ margin: "10px 0 0", fontSize: 12, color: color.textMuted }}>{rationale}</p>}
          </div>

          {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}
        </div>
      </div>

      {pickerModal}

      <Modal open={confirmRefresh} onClose={() => setConfirmRefresh(false)} width={440}>
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, margin: "0 0 8px" }}>Recompose the mockup?</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: color.textMuted }}>
          The agent starts over from the current storyboard with the same photos. Your manual edits on this mockup will be lost.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="secondary" onClick={() => setConfirmRefresh(false)}>
            Cancel
          </Button>
          <Button onClick={refresh}>Recompose</Button>
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

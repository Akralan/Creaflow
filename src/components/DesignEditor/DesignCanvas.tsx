"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { accent } from "@/lib/design/tokens";
import type { TimelineEntry } from "@/lib/apiClient";
import { layerElements, pastePlainText, scrubEditedTextLayer } from "./designDom";
import { buildSlideAnimations, type SlideAnimations } from "./slideAnimations";

/**
 * Canevas d'une slide (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §6) : le HTML rendu est injecté tel quel
 * (déjà passé par la liste blanche côté serveur), mis à l'échelle, et manipulé à la main —
 * sélection d'un calque, déplacement, redimensionnement, édition du texte en place. Pendant un
 * geste, le DOM est la vérité (fluidité) ; à la fin, `onCommit` reçoit le HTML résultant.
 */
export default function DesignCanvas({
  html,
  width,
  height,
  displayWidth,
  selectedLayerId,
  onSelectLayer,
  onCommit,
  readOnly = false,
  timeline = null,
  durationMs = null,
  playheadMs = 0,
  playing = false,
  onPlayheadChange,
}: {
  /** HTML affichable (placeholders résolus, polices traduites). */
  html: string;
  width: number;
  height: number;
  displayWidth: number;
  selectedLayerId: string | null;
  onSelectLayer: (id: string | null) => void;
  onCommit: (renderedHtml: string) => void;
  /** Vrai pendant qu'une instruction ou un export est en vol : aucune retouche manuelle ne doit
   *  entrer en course avec la version qui va arriver. */
  readOnly?: boolean;
  /** Animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §6) : ligne de temps rejouée par la Web
   *  Animations API sur le DOM rendu ; null pour une maquette statique. */
  timeline?: TimelineEntry[] | null;
  durationMs?: number | null;
  playheadMs?: number;
  playing?: boolean;
  onPlayheadChange?: (ms: number) => void;
}) {
  const scale = displayWidth / width;
  const displayHeight = Math.round(height * scale);
  const hostRef = useRef<HTMLDivElement>(null);
  const appliedHtmlRef = useRef<string | null>(null);
  const [selBox, setSelBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const dragRef = useRef<{
    kind: "move" | "resize";
    layer: HTMLElement;
    startX: number;
    startY: number;
    top: number;
    left: number;
    w: number;
    h: number;
    moved: boolean;
  } | null>(null);

  const animsRef = useRef<SlideAnimations | null>(null);
  const playheadRef = useRef(playheadMs);
  useLayoutEffect(() => {
    playheadRef.current = playheadMs;
  }, [playheadMs]);

  const root = useCallback((): HTMLElement | null => {
    const el = hostRef.current?.firstElementChild;
    return el instanceof HTMLElement ? el : null;
  }, []);

  // Injecte le HTML seulement quand il change vraiment : pendant un geste local, la prop est
  // encore l'ancienne valeur et ne doit pas écraser le DOM manipulé.
  useLayoutEffect(() => {
    if (!hostRef.current || appliedHtmlRef.current === html) return;
    hostRef.current.innerHTML = html;
    appliedHtmlRef.current = html;
  }, [html]);

  // Reconstruit les animations quand le HTML injecté, la ligne de temps ou la durée changent.
  const timelineKey = timeline ? JSON.stringify(timeline) : "";
  useLayoutEffect(() => {
    animsRef.current?.cancel();
    animsRef.current = null;
    const r = root();
    if (!r || !timeline || !durationMs) return;
    const anims = buildSlideAnimations(r, timeline, durationMs);
    anims.seek(playheadRef.current);
    animsRef.current = anims;
    return () => {
      anims.cancel();
      animsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, timelineKey, durationMs, root]);

  // Curseur : à l'arrêt, chaque changement de playhead positionne les animations.
  useEffect(() => {
    if (!playing) animsRef.current?.seek(playheadMs);
  }, [playheadMs, playing]);

  // Lecture : la Web Animations API avance seule, on remonte le temps courant et on boucle.
  useEffect(() => {
    const anims = animsRef.current;
    if (!anims || !durationMs) return;
    if (!playing) {
      anims.pause();
      return;
    }
    if (anims.currentTime() >= durationMs - 1) anims.seek(0);
    anims.play();
    let raf = 0;
    const tick = () => {
      const t = anims.currentTime();
      if (t >= durationMs) {
        anims.seek(0);
        anims.play();
      }
      onPlayheadChange?.(Math.min(durationMs, t));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      anims.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, durationMs, timelineKey, html]);

  const refreshSelBox = useCallback(() => {
    const r = root();
    if (!r || !selectedLayerId) {
      setSelBox(null);
      return;
    }
    const layer = layerElements(r).find((l) => l.getAttribute("data-layer") === selectedLayerId);
    if (!layer) {
      setSelBox(null);
      return;
    }
    setSelBox({
      top: layer.offsetTop * scale,
      left: layer.offsetLeft * scale,
      width: layer.offsetWidth * scale,
      height: layer.offsetHeight * scale,
    });
  }, [root, selectedLayerId, scale]);

  useEffect(() => {
    // Mesure du DOM (offsetTop/offsetLeft du calque) après injection du HTML : c'est une lecture
    // d'un système externe, pas un état dérivable pendant le rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshSelBox();
  }, [refreshSelBox, html]);

  function layerFromEvent(target: EventTarget | null): HTMLElement | null {
    const r = root();
    if (!r || !(target instanceof Element)) return null;
    let node: Element | null = target;
    while (node && node.parentElement !== r) node = node.parentElement;
    return node instanceof HTMLElement && node.hasAttribute("data-layer") ? node : null;
  }

  function commit() {
    const r = root();
    if (!r) return;
    const next = r.outerHTML;
    appliedHtmlRef.current = next;
    onCommit(next);
  }

  function beginMove(e: React.MouseEvent) {
    if (editing || readOnly || playing) return;
    const layer = layerFromEvent(e.target);
    if (!layer) {
      onSelectLayer(null);
      return;
    }
    const id = layer.getAttribute("data-layer");
    onSelectLayer(id);
    e.preventDefault();
    dragRef.current = {
      kind: "move",
      layer,
      startX: e.clientX,
      startY: e.clientY,
      top: layer.offsetTop,
      left: layer.offsetLeft,
      w: layer.offsetWidth,
      h: layer.offsetHeight,
      moved: false,
    };
  }

  function beginResize(e: React.MouseEvent) {
    const r = root();
    if (!r || !selectedLayerId || readOnly) return;
    const layer = layerElements(r).find((l) => l.getAttribute("data-layer") === selectedLayerId);
    if (!layer) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      kind: "resize",
      layer,
      startX: e.clientX,
      startY: e.clientY,
      top: layer.offsetTop,
      left: layer.offsetLeft,
      w: layer.offsetWidth,
      h: layer.offsetHeight,
      moved: false,
    };
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / scale;
      const dy = (e.clientY - d.startY) / scale;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !d.moved) return;
      d.moved = true;
      if (d.kind === "move") {
        d.layer.style.removeProperty("right");
        d.layer.style.removeProperty("bottom");
        d.layer.style.left = `${Math.round(d.left + dx)}px`;
        d.layer.style.top = `${Math.round(d.top + dy)}px`;
      } else {
        d.layer.style.width = `${Math.max(24, Math.round(d.w + dx))}px`;
        d.layer.style.height = `${Math.max(24, Math.round(d.h + dy))}px`;
      }
      refreshSelBox();
    }
    function onUp() {
      const d = dragRef.current;
      dragRef.current = null;
      if (d?.moved) commit();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, refreshSelBox]);

  function beginTextEdit(e: React.MouseEvent) {
    if (readOnly || playing) return;
    const layer = layerFromEvent(e.target);
    if (!layer || layer.getAttribute("data-type") !== "text") return;
    e.preventDefault();
    onSelectLayer(layer.getAttribute("data-layer"));
    layer.contentEditable = "true";
    layer.style.outline = "none";
    layer.focus();
    setEditing(true);
    // Un collage n'apporte que du texte : jamais de HTML riche dans un calque.
    layer.addEventListener("paste", pastePlainText);
    const finish = () => {
      layer.removeEventListener("blur", finish);
      layer.removeEventListener("paste", pastePlainText);
      layer.removeAttribute("contenteditable");
      layer.style.removeProperty("outline");
      scrubEditedTextLayer(layer);
      setEditing(false);
      commit();
    };
    layer.addEventListener("blur", finish);
  }

  return (
    <div
      style={{
        position: "relative",
        width: displayWidth,
        height: displayHeight,
        overflow: "hidden",
        borderRadius: 8,
        boxShadow: "0 2px 12px rgba(28,25,23,0.12)",
        background: "#fff",
        userSelect: editing ? "text" : "none",
        opacity: readOnly ? 0.7 : 1,
        cursor: readOnly ? "progress" : undefined,
      }}
      onMouseDown={beginMove}
      onDoubleClick={beginTextEdit}
    >
      <div
        ref={hostRef}
        data-design-host
        style={{ position: "absolute", top: 0, left: 0, width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}
      />
      {selBox && !editing && (
        <div
          style={{
            position: "absolute",
            top: selBox.top,
            left: selBox.left,
            width: selBox.width,
            height: selBox.height,
            border: `1.5px solid ${accent}`,
            pointerEvents: "none",
            boxSizing: "border-box",
          }}
        >
          <div
            onMouseDown={beginResize}
            title="Redimensionner"
            style={{
              position: "absolute",
              right: -6,
              bottom: -6,
              width: 12,
              height: 12,
              background: "#fff",
              border: `1.5px solid ${accent}`,
              borderRadius: 3,
              cursor: "nwse-resize",
              pointerEvents: "auto",
            }}
          />
        </div>
      )}
    </div>
  );
}

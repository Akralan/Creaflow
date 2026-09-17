import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import type { TimelineEntry } from "@/lib/apiClient";
import { buildSlideAnimations } from "./slideAnimations";

/**
 * Export vidéo d'une animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §2 « Export vidéo »),
 * uniquement sur le bouton : la slide est rendue image par image dans un conteneur hors écran
 * (html-to-image), chaque image est encodée en H.264 par WebCodecs et muxée en MP4 dans le
 * navigateur. Chrome et Edge ; ailleurs, `videoExportSupport()` explique pourquoi.
 */
export const VIDEO_FPS = 30;
const BITRATE = 6_000_000;
// High 4.0 couvre 1080×1920 à 30 i/s ; Main 4.0 en repli.
const CODECS = ["avc1.640028", "avc1.4d0028"];

export async function videoExportSupport(width: number, height: number): Promise<{ ok: true; codec: string } | { ok: false; reason: string }> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    return { ok: false, reason: "Export vidéo disponible sur Chrome ou Edge (WebCodecs absent ici)." };
  }
  for (const codec of CODECS) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate: BITRATE, framerate: VIDEO_FPS });
      if (supported) return { ok: true, codec };
    } catch {
      // codec suivant
    }
  }
  return { ok: false, reason: "Ce navigateur ne sait pas encoder en H.264 à cette taille." };
}

export interface ExportAnimationParams {
  renderableHtml: string;
  width: number;
  height: number;
  durationMs: number;
  timeline: TimelineEntry[];
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export async function renderAnimationToMp4(params: ExportAnimationParams): Promise<Blob> {
  const support = await videoExportSupport(params.width, params.height);
  if (!support.ok) throw new Error(support.reason);

  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${params.width}px;height:${params.height}px;overflow:hidden;pointer-events:none;`;
  host.innerHTML = params.renderableHtml;
  document.body.appendChild(host);
  const root = host.firstElementChild as HTMLElement | null;
  if (!root) {
    host.remove();
    throw new Error("Slide vide.");
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: params.width, height: params.height, frameRate: VIDEO_FPS },
    fastStart: "in-memory",
  });
  let encodeError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure({ codec: support.codec, width: params.width, height: params.height, bitrate: BITRATE, framerate: VIDEO_FPS, avc: { format: "avc" } });

  const anims = buildSlideAnimations(root, params.timeline, params.durationMs);
  const total = Math.max(1, Math.round((params.durationMs / 1000) * VIDEO_FPS));
  try {
    await Promise.all(
      Array.from(host.querySelectorAll("img")).map((img) =>
        img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
      )
    );
    if (typeof document.fonts?.ready?.then === "function") await document.fonts.ready;
    // Les polices sont résolues une fois pour toutes : c'est la partie coûteuse d'html-to-image.
    const fontEmbedCSS = await getFontEmbedCSS(root);
    for (let i = 0; i < total; i += 1) {
      if (params.signal?.aborted) throw new Error("Export annulé.");
      if (encodeError) throw encodeError;
      anims.seek((i * 1000) / VIDEO_FPS);
      const canvas = await toCanvas(root, { width: params.width, height: params.height, pixelRatio: 1, cacheBust: false, fontEmbedCSS });
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1_000_000) / VIDEO_FPS), duration: Math.round(1_000_000 / VIDEO_FPS) });
      encoder.encode(frame, { keyFrame: i % VIDEO_FPS === 0 });
      frame.close();
      params.onProgress?.(i + 1, total);
      // Laisse l'encodeur respirer : sans ça, la file grossit et la page se fige.
      if (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 0));
    }
    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: "video/mp4" });
  } finally {
    anims.cancel();
    if (encoder.state !== "closed") encoder.close();
    host.remove();
  }
}

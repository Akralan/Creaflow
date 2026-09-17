import { toBlob } from "html-to-image";
import { zipSync } from "fflate";

/**
 * Export PNG dans le navigateur (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 « Export ») : chaque slide
 * est rendue à taille native dans un conteneur hors écran, puis convertie par html-to-image (DOM →
 * SVG foreignObject → canvas). Les images de base sont same-origin et les polices viennent des
 * @font-face de next/font, donc embarquables.
 */
export async function renderSlideToPng(renderableHtml: string, width: number, height: number): Promise<Blob> {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;overflow:hidden;pointer-events:none;`;
  host.innerHTML = renderableHtml;
  document.body.appendChild(host);
  try {
    const root = host.firstElementChild as HTMLElement | null;
    if (!root) throw new Error("Slide vide.");
    await Promise.all(
      Array.from(host.querySelectorAll("img")).map((img) =>
        img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        })
      )
    );
    if (typeof document.fonts?.ready?.then === "function") await document.fonts.ready;
    const blob = await toBlob(root, { width, height, pixelRatio: 1, cacheBust: false, type: "image/png" });
    if (!blob) throw new Error("Rendu impossible.");
    return blob;
  } finally {
    host.remove();
  }
}

export async function zipBlobs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer());
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([zipped], { type: "application/zip" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

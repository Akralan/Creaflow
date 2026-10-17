import { DESIGN_FONTS, toRenderableFontFamily } from "@/lib/visualDesign/fonts";
import { imagePlaceholder, parseImagePlaceholder } from "@/lib/visualDesign/designImages";

/**
 * Conversion between the stored HTML (placeholders, readable font names) and the HTML rendered in the
 * browser (same-origin URLs, next/font CSS variables), plus the layer manipulations of
 * manual editing. This whole file assumes a DOM (client). The server re-runs anyway
 * every write through the allowlist: here we validate nothing, we only transform.
 */

export const LOGO_PLACEHOLDER = "{{LOGO}}";

export interface RenderUrls {
  /** Same-origin URL of each photo in the mockup, by reference (`p1` → `/api/scripts/…/design/images/p1`). */
  images: Record<string, string>;
  logoUrl: string | null;
}

const VARIABLE_TO_NAME = new Map(DESIGN_FONTS.map((f) => [f.cssVariable, f.name]));

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Stored HTML → displayable HTML: placeholders resolved, fonts translated to CSS variables. */
export function toRenderableHtml(html: string, urls: RenderUrls): string {
  let out = html;
  for (const [ref, url] of Object.entries(urls.images)) out = out.split(imagePlaceholder(ref)).join(url);
  out = out.split(LOGO_PLACEHOLDER).join(urls.logoUrl ?? "");
  for (const font of DESIGN_FONTS) {
    // The browser may have quoted the name ("Playfair Display") during a manual edit.
    const re = new RegExp(`font-family:\\s*(['"]?)${escapeRegExp(font.name)}\\1\\s*(?=[;"])`, "g");
    out = out.replace(re, `font-family:${toRenderableFontFamily(font.name)}`);
  }
  return out;
}

/** Displayed HTML (DOM) → HTML to store: URLs put back as placeholders, CSS variables as font names. */
export function fromRenderedHtml(html: string, urls: RenderUrls): string {
  let out = html;
  for (const [ref, url] of Object.entries(urls.images)) if (url) out = out.split(url).join(imagePlaceholder(ref));
  if (urls.logoUrl) out = out.split(urls.logoUrl).join(LOGO_PLACEHOLDER);
  // The browser may rewrite `font-family: var(--x), a, b` as `font-family: var(--x), a, b` or
  // expand the value; we only depend on the presence of the variable.
  out = out.replace(/font-family:\s*var\((--font-design-[a-z-]+)\)[^;"]*/g, (_m, variable: string) => {
    const name = VARIABLE_TO_NAME.get(variable);
    return `font-family:${name ?? "Inter"}`;
  });
  return out;
}

/** Parses a slide's HTML (rendered or stored) into a detached root element. */
export function parseSlide(html: string): HTMLElement | null {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const root = doc.body.firstElementChild;
  return root instanceof HTMLElement ? root : null;
}

export function layerElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.children).filter((c): c is HTMLElement => c instanceof HTMLElement && c.hasAttribute("data-layer"));
}

export function findLayer(root: HTMLElement, layerId: string): HTMLElement | null {
  return layerElements(root).find((l) => l.getAttribute("data-layer") === layerId) ?? null;
}

/** Applies styles to a layer and returns the resulting HTML (stored or rendered, depending on the input). */
export function updateLayerStyle(html: string, layerId: string, styles: Record<string, string | null>): string {
  const root = parseSlide(html);
  if (!root) return html;
  const layer = findLayer(root, layerId);
  if (!layer) return html;
  for (const [prop, value] of Object.entries(styles)) {
    if (value === null || value === "") layer.style.removeProperty(prop);
    else layer.style.setProperty(prop, value);
  }
  return root.outerHTML;
}

export function removeLayer(html: string, layerId: string): string {
  const root = parseSlide(html);
  if (!root) return html;
  findLayer(root, layerId)?.remove();
  return root.outerHTML;
}

export function moveLayer(html: string, layerId: string, direction: "up" | "down"): string {
  const root = parseSlide(html);
  if (!root) return html;
  const layer = findLayer(root, layerId);
  if (!layer) return html;
  if (direction === "up" && layer.nextElementSibling) layer.nextElementSibling.after(layer);
  if (direction === "down" && layer.previousElementSibling) layer.previousElementSibling.before(layer);
  return root.outerHTML;
}

export function setLayerText(html: string, layerId: string, text: string): string {
  const root = parseSlide(html);
  if (!root) return html;
  const layer = findLayer(root, layerId);
  if (!layer) return html;
  // Targets the deepest text element that carries text, to keep the structure (flex,
  // spans) of the layer.
  const target = deepestTextHost(layer);
  target.textContent = text;
  return root.outerHTML;
}

function deepestTextHost(el: HTMLElement): HTMLElement {
  const hosts = Array.from(el.children).filter((c): c is HTMLElement => c instanceof HTMLElement && (c.textContent ?? "").trim().length > 0);
  if (hosts.length === 1 && !Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim())) {
    return deepestTextHost(hosts[0]);
  }
  return el;
}

export interface LayerInfo {
  id: string;
  type: "text" | "image" | "shape";
  text: string;
  style: Record<string, string>;
  /** Image layer: reference of the displayed photo (`p1`), or null (logo). */
  imageRef: string | null;
  /** Image layer: styles of the <img> tag itself (object-fit). */
  imageStyle: Record<string, string>;
}

const INSPECTED_PROPS = ["top", "left", "width", "height", "font-family", "font-size", "font-weight", "color", "text-align", "background", "background-color", "opacity", "border-radius", "line-height", "clip-path", "transform", "box-shadow"];

export function describeLayer(html: string, layerId: string): LayerInfo | null {
  const root = parseSlide(html);
  if (!root) return null;
  const layer = findLayer(root, layerId);
  if (!layer) return null;
  const style: Record<string, string> = {};
  for (const prop of INSPECTED_PROPS) {
    const v = layer.style.getPropertyValue(prop);
    if (v) style[prop] = v;
  }
  // The font may be set on a child (flex structure): we take the first one found.
  if (!style["font-family"] || !style["font-size"] || !style.color) {
    const inner = layer.querySelector<HTMLElement>("[style*='font']") ?? layer.querySelector<HTMLElement>("[style*='color']");
    if (inner) {
      for (const prop of ["font-family", "font-size", "font-weight", "color"]) {
        if (!style[prop]) {
          const v = inner.style.getPropertyValue(prop);
          if (v) style[prop] = v;
        }
      }
    }
  }
  const type = (layer.getAttribute("data-type") as LayerInfo["type"]) ?? "text";
  const img = layer.querySelector("img");
  const imageStyle: Record<string, string> = {};
  if (img) {
    for (const prop of ["object-fit", "object-position"]) {
      const v = img.style.getPropertyValue(prop);
      if (v) imageStyle[prop] = v;
    }
  }
  return {
    id: layerId,
    type,
    text: (layer.textContent ?? "").replace(/\s+/g, " ").trim(),
    style,
    imageRef: img ? imageRefOfSrc(img.getAttribute("src") ?? "") : null,
    imageStyle,
  };
}

/** `src` of an <img> (stored placeholder, or rendered URL `…/design/images/p2?…`) → reference `p2`. */
export function imageRefOfSrc(src: string): string | null {
  const stored = parseImagePlaceholder(src);
  if (stored) return stored;
  const m = /\/design\/images\/(p[1-6])(?:[?#]|$)/.exec(src);
  return m ? m[1] : null;
}

/** Replaces the photo of an image layer with another reference (stored HTML). */
export function setLayerImageRef(html: string, layerId: string, ref: string): string {
  const root = parseSlide(html);
  if (!root) return html;
  const img = findLayer(root, layerId)?.querySelector("img");
  if (!img) return html;
  img.setAttribute("src", imagePlaceholder(ref));
  return root.outerHTML;
}

/** Styles of the <img> tag of an image layer (object-fit…). */
export function updateLayerImageStyle(html: string, layerId: string, styles: Record<string, string | null>): string {
  const root = parseSlide(html);
  if (!root) return html;
  const img = findLayer(root, layerId)?.querySelector("img");
  if (!img) return html;
  for (const [prop, value] of Object.entries(styles)) {
    if (value === null || value === "") img.style.removeProperty(prop);
    else img.style.setProperty(prop, value);
  }
  return root.outerHTML;
}

/**
 * Adds a layer (single-element HTML, `data-type` set) at the end of the slide, with a free
 * identifier. Returns the stored HTML and the identifier. The server will run the allowlist again.
 */
export function appendLayer(html: string, layerHtml: string): { html: string; layerId: string } {
  const root = parseSlide(html);
  if (!root) return { html, layerId: "" };
  const used = new Set(layerElements(root).map((l) => l.getAttribute("data-layer")));
  let n = used.size + 1;
  let layerId = `l${n}`;
  while (used.has(layerId)) layerId = `l${++n}`;
  const tpl = document.createElement("template");
  tpl.innerHTML = layerHtml.trim();
  const el = tpl.content.firstElementChild;
  if (!(el instanceof HTMLElement)) return { html, layerId: "" };
  el.setAttribute("data-layer", layerId);
  if (!el.getAttribute("data-type")) el.setAttribute("data-type", el.querySelector("img") ? "image" : "shape");
  root.appendChild(el);
  return { html: root.outerHTML, layerId };
}

/** Image layer ready to place: centered photo, 60% of the canvas, object-fit:cover (docs/SPEC_COMPOSITION_VISUELLE.md §6). */
export function buildImageLayerHtml(ref: string, canvas: { width: number; height: number }): string {
  const w = Math.round(canvas.width * 0.6);
  const h = Math.round(canvas.height * 0.6);
  const top = Math.round((canvas.height - h) / 2);
  const left = Math.round((canvas.width - w) / 2);
  return `<div data-type="image" style="position:absolute;top:${top}px;left:${left}px;width:${w}px;height:${h}px;overflow:hidden;border-radius:${Math.round(canvas.width * 0.02)}px"><img src="${imagePlaceholder(ref)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
}

/** Duplicates a slide, renumbering its layers. */
export function nextPlanNumber(slides: { planNumber: number }[]): number {
  return slides.reduce((max, s) => Math.max(max, s.planNumber), 0) + 1;
}

const EDIT_ALLOWED_TAGS = new Set(["DIV", "SPAN", "P", "H1", "H2", "H3", "H4", "STRONG", "EM", "BR"]);

/**
 * Local cleanup of a text layer after in-place editing (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §8):
 * a paste can drop rich HTML into it (images, event attributes). The server will run
 * the allowlist again, but this HTML is re-injected via innerHTML even before saving — so we only keep
 * the text structure, with no attribute other than style. The real safeguard remains on the
 * server side.
 */
export function scrubEditedTextLayer(layer: HTMLElement): void {
  for (const el of Array.from(layer.querySelectorAll("*"))) {
    if (!EDIT_ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(document.createTextNode(el.textContent ?? ""));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      if (attr.name !== "style") el.removeAttribute(attr.name);
    }
  }
  for (const attr of Array.from(layer.attributes)) {
    if (!["style", "data-layer", "data-type"].includes(attr.name)) layer.removeAttribute(attr.name);
  }
}

/** Plain-text paste into a layer being edited. */
export function pastePlainText(e: ClipboardEvent): void {
  e.preventDefault();
  const text = e.clipboardData?.getData("text/plain") ?? "";
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

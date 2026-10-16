import { DESIGN_FONTS, toRenderableFontFamily } from "@/lib/visualDesign/fonts";
import { imagePlaceholder, parseImagePlaceholder } from "@/lib/visualDesign/designImages";

/**
 * Passage entre le HTML stocké (placeholders, noms de polices lisibles) et le HTML rendu dans le
 * navigateur (URLs same-origin, variables CSS de next/font), plus les manipulations de calques de
 * l'édition manuelle. Tout ce fichier suppose un DOM (client). Le serveur repasse de toute façon
 * chaque écriture par la liste blanche : ici on ne valide rien, on transforme.
 */

export const LOGO_PLACEHOLDER = "{{LOGO}}";

export interface RenderUrls {
  /** URL same-origin de chaque photo de la maquette, par référence (`p1` → `/api/scripts/…/design/images/p1`). */
  images: Record<string, string>;
  logoUrl: string | null;
}

const VARIABLE_TO_NAME = new Map(DESIGN_FONTS.map((f) => [f.cssVariable, f.name]));

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** HTML stocké → HTML affichable : placeholders résolus, polices traduites en variables CSS. */
export function toRenderableHtml(html: string, urls: RenderUrls): string {
  let out = html;
  for (const [ref, url] of Object.entries(urls.images)) out = out.split(imagePlaceholder(ref)).join(url);
  out = out.split(LOGO_PLACEHOLDER).join(urls.logoUrl ?? "");
  for (const font of DESIGN_FONTS) {
    // Le navigateur peut avoir cité le nom (« "Playfair Display" ») lors d'une retouche manuelle.
    const re = new RegExp(`font-family:\\s*(['"]?)${escapeRegExp(font.name)}\\1\\s*(?=[;"])`, "g");
    out = out.replace(re, `font-family:${toRenderableFontFamily(font.name)}`);
  }
  return out;
}

/** HTML affiché (DOM) → HTML à stocker : URLs remises en placeholders, variables CSS en noms de polices. */
export function fromRenderedHtml(html: string, urls: RenderUrls): string {
  let out = html;
  for (const [ref, url] of Object.entries(urls.images)) if (url) out = out.split(url).join(imagePlaceholder(ref));
  if (urls.logoUrl) out = out.split(urls.logoUrl).join(LOGO_PLACEHOLDER);
  // Le navigateur peut réécrire `font-family: var(--x), a, b` en `font-family: var(--x), a, b` ou
  // développer la valeur ; on ne dépend que de la présence de la variable.
  out = out.replace(/font-family:\s*var\((--font-design-[a-z-]+)\)[^;"]*/g, (_m, variable: string) => {
    const name = VARIABLE_TO_NAME.get(variable);
    return `font-family:${name ?? "Inter"}`;
  });
  return out;
}

/** Parse un HTML de slide (rendu ou stocké) en élément racine détaché. */
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

/** Applique des styles à un calque et renvoie le HTML résultant (stocké ou rendu, selon l'entrée). */
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
  // Cible l'élément de texte le plus profond qui porte du texte, pour garder la structure (flex,
  // spans) du calque.
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
  /** Calque image : référence de la photo affichée (`p1`), ou null (logo). */
  imageRef: string | null;
  /** Calque image : styles de la balise <img> elle-même (object-fit). */
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
  // La police peut être posée sur un enfant (structure flex) : on remonte la première trouvée.
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

/** `src` d'une <img> (placeholder stocké, ou URL rendue `…/design/images/p2?…`) → référence `p2`. */
export function imageRefOfSrc(src: string): string | null {
  const stored = parseImagePlaceholder(src);
  if (stored) return stored;
  const m = /\/design\/images\/(p[1-6])(?:[?#]|$)/.exec(src);
  return m ? m[1] : null;
}

/** Remplace la photo d'un calque image par une autre référence (HTML stocké). */
export function setLayerImageRef(html: string, layerId: string, ref: string): string {
  const root = parseSlide(html);
  if (!root) return html;
  const img = findLayer(root, layerId)?.querySelector("img");
  if (!img) return html;
  img.setAttribute("src", imagePlaceholder(ref));
  return root.outerHTML;
}

/** Styles de la balise <img> d'un calque image (object-fit…). */
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
 * Ajoute un calque (HTML d'un seul élément, `data-type` posé) en fin de slide, avec un identifiant
 * libre. Renvoie le HTML stocké et l'identifiant. Le serveur refera passer la liste blanche.
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

/** Calque image prêt à poser : photo centrée, 60 % du canevas, object-fit:cover (docs/SPEC_COMPOSITION_VISUELLE.md §6). */
export function buildImageLayerHtml(ref: string, canvas: { width: number; height: number }): string {
  const w = Math.round(canvas.width * 0.6);
  const h = Math.round(canvas.height * 0.6);
  const top = Math.round((canvas.height - h) / 2);
  const left = Math.round((canvas.width - w) / 2);
  return `<div data-type="image" style="position:absolute;top:${top}px;left:${left}px;width:${w}px;height:${h}px;overflow:hidden;border-radius:${Math.round(canvas.width * 0.02)}px"><img src="${imagePlaceholder(ref)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
}

/** Duplique une slide en renumérotant son plan. */
export function nextPlanNumber(slides: { planNumber: number }[]): number {
  return slides.reduce((max, s) => Math.max(max, s.planNumber), 0) + 1;
}

const EDIT_ALLOWED_TAGS = new Set(["DIV", "SPAN", "P", "H1", "H2", "H3", "H4", "STRONG", "EM", "BR"]);

/**
 * Nettoyage local d'un calque texte après édition en place (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §8) :
 * un collage peut y déposer du HTML riche (images, attributs d'événement). Le serveur refera passer
 * la liste blanche, mais ce HTML est réinjecté par innerHTML avant même la sauvegarde — on ne garde
 * donc que la structure textuelle, sans attribut autre que style. Le vrai garde-fou reste côté
 * serveur.
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

/** Collage en texte brut dans un calque en édition. */
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

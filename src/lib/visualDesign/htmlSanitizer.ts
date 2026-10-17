import { resolveDesignFont } from "./fonts";
import { parseImagePlaceholder } from "./designImages";

/**
 * Liste blanche et normalisation du HTML d'une slide (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §5.1).
 * Applied to EVERY write — model output as well as manual edits. Home-made parser,
 * deliberately strict: what it doesn't understand is refused, and the output is reserialized in
 * canonical form (never the input text). No dependency, no DOM access.
 */

export const MAX_LAYERS_PER_SLIDE = 12;
export const MAX_SLIDE_HTML_BYTES = 24 * 1024;

export const LOGO_PLACEHOLDER = "{{LOGO}}";

const ALLOWED_TAGS = new Set(["div", "span", "p", "h1", "h2", "h3", "h4", "strong", "em", "br", "img"]);
const VOID_TAGS = new Set(["br", "img"]);
const ALLOWED_ATTRS = new Set(["style", "data-layer", "data-type", "src", "alt"]);
const LAYER_TYPES = new Set(["text", "image", "shape"]);

const ALLOWED_CSS_PROPS = new Set([
  // Mise en page
  "display",
  "flex-direction",
  "flex-wrap",
  "flex",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-items",
  "align-self",
  "justify-content",
  "gap",
  "row-gap",
  "column-gap",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "overflow",
  "z-index",
  "box-sizing",
  "object-fit",
  "object-position",
  // Typographie
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration",
  "white-space",
  "word-break",
  "color",
  // Decoration
  "background",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-radius",
  "border-color",
  "border-width",
  "border-style",
  "box-shadow",
  "text-shadow",
  "opacity",
  "transform",
  "transform-origin",
  "filter",
  // Montages (docs/SPEC_COMPOSITION_VISUELLE.md §2 « Liste blanche ») : photo en rond ou en
  // medallion, frames. `backdrop-filter` excluded (poorly rendered by html-to-image).
  "clip-path",
  "outline",
  "outline-color",
  "outline-width",
  "outline-style",
  "outline-offset",
  "aspect-ratio",
]);

const FORBIDDEN_VALUE_RE = /url\s*\(|expression\s*\(|@import|javascript:|<|>|\\/i;
const GRADIENT_RE = /^(linear|radial|conic)-gradient\(/i;

export class DesignValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Slide HTML rejected: ${issues.join(" · ")}`);
    this.name = "DesignValidationError";
    this.issues = issues;
  }
}

export interface DesignElement {
  tag: string;
  attrs: Record<string, string>;
  children: DesignChild[];
}
export type DesignChild = DesignElement | { text: string };

// --- Parseur ---

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  acirc: "â",
  ccedil: "ç",
  ugrave: "ù",
  ucirc: "û",
  ocirc: "ô",
  icirc: "î",
  iuml: "ï",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  ndash: "–",
  mdash: "—",
  copy: "©",
  deg: "°",
  euro: "€",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1].toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

function encodeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function encodeAttr(text: string): string {
  return encodeText(text).replace(/"/g, "&quot;");
}

class Parser {
  private pos = 0;
  private readonly issues: string[] = [];

  constructor(private readonly input: string) {}

  parseDocument(): { root: DesignElement | null; issues: string[] } {
    const nodes = this.parseChildren(null);
    const elements = nodes.filter((n): n is DesignElement => "tag" in n);
    const stray = nodes.filter((n) => "text" in n && n.text.trim().length > 0);
    if (stray.length > 0) this.issues.push("text outside the root element");
    if (elements.length !== 1) this.issues.push(`a single root element expected, ${elements.length} found`);
    return { root: elements[0] ?? null, issues: this.issues };
  }

  private parseChildren(parentTag: string | null): DesignChild[] {
    const children: DesignChild[] = [];
    while (this.pos < this.input.length) {
      if (this.input.startsWith("</", this.pos)) {
        const end = this.input.indexOf(">", this.pos);
        if (end === -1) {
          this.issues.push("unterminated closing tag");
          this.pos = this.input.length;
          return children;
        }
        const name = this.input.slice(this.pos + 2, end).trim().toLowerCase();
        this.pos = end + 1;
        if (name !== parentTag) this.issues.push(`unexpected closing </${name}>`);
        return children;
      }
      if (this.input.startsWith("<!--", this.pos)) {
        const end = this.input.indexOf("-->", this.pos);
        this.pos = end === -1 ? this.input.length : end + 3;
        continue;
      }
      if (this.input[this.pos] === "<") {
        const element = this.parseElement();
        if (element) children.push(element);
        continue;
      }
      const next = this.input.indexOf("<", this.pos);
      const raw = this.input.slice(this.pos, next === -1 ? this.input.length : next);
      this.pos = next === -1 ? this.input.length : next;
      children.push({ text: decodeEntities(raw) });
    }
    if (parentTag !== null) this.issues.push(`<${parentTag}> never closed`);
    return children;
  }

  private parseElement(): DesignElement | null {
    const tagMatch = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(this.input.slice(this.pos));
    if (!tagMatch) {
      this.issues.push(`stray "<" character at position ${this.pos}`);
      this.pos += 1;
      return null;
    }
    const tag = tagMatch[1].toLowerCase();
    this.pos += tagMatch[0].length;
    const attrs: Record<string, string> = {};
    let selfClosing = false;
    for (;;) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) {
        this.issues.push(`<${tag}> unterminated`);
        return null;
      }
      if (this.input.startsWith("/>", this.pos)) {
        selfClosing = true;
        this.pos += 2;
        break;
      }
      if (this.input[this.pos] === ">") {
        this.pos += 1;
        break;
      }
      const attrMatch = /^([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/.exec(this.input.slice(this.pos));
      if (!attrMatch) {
        this.issues.push(`unreadable attribute in <${tag}>`);
        return null;
      }
      this.pos += attrMatch[0].length;
      const name = attrMatch[1].toLowerCase();
      const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
      attrs[name] = decodeEntities(value);
    }
    if (!ALLOWED_TAGS.has(tag)) {
      this.issues.push(`tag <${tag}> is forbidden`);
      // We still consume its content to continue the analysis.
      if (!selfClosing && !VOID_TAGS.has(tag)) this.parseChildren(tag);
      return null;
    }
    const children = selfClosing || VOID_TAGS.has(tag) ? [] : this.parseChildren(tag);
    return { tag, attrs, children };
  }

  private skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) this.pos += 1;
  }
}

// --- Styles ---

/** Splits a declaration `a: b; c: d(e; f)` while respecting parentheses. */
function splitDeclarations(style: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of style) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export interface StyleMap {
  [prop: string]: string;
}

export function parseStyle(style: string, issues: string[], where: string): StyleMap {
  const out: StyleMap = {};
  for (const declaration of splitDeclarations(style)) {
    const colon = declaration.indexOf(":");
    if (colon === -1) {
      issues.push(`${where}: declaration without ":" (${declaration.slice(0, 30)})`);
      continue;
    }
    const prop = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim().replace(/\s*!important$/i, "");
    if (!ALLOWED_CSS_PROPS.has(prop)) {
      issues.push(`${where}: property "${prop}" is forbidden`);
      continue;
    }
    if (FORBIDDEN_VALUE_RE.test(value)) {
      issues.push(`${where}: forbidden value for "${prop}"`);
      continue;
    }
    if (value.length > 300) {
      issues.push(`${where}: value too long for "${prop}"`);
      continue;
    }
    // A photo goes through <img src="{{IMG:p1}}"> (url() is banned above, placeholder included):
    // here only a color or a gradient is accepted.
    if ((prop === "background-image" || prop === "background") && /gradient|image/i.test(value) && !GRADIENT_RE.test(value)) {
      issues.push(`${where}: "${prop}" only accepts a color or a gradient`);
      continue;
    }
    if (prop === "font-family") {
      const font = resolveDesignFont(value);
      if (!font) {
        issues.push(`${where}: font "${value.slice(0, 40)}" is not in the list`);
        continue;
      }
      out[prop] = font.name;
      continue;
    }
    if (prop === "position" && !["absolute", "relative", "static"].includes(value.toLowerCase())) {
      issues.push(`${where}: position "${value}" is forbidden`);
      continue;
    }
    out[prop] = value;
  }
  return out;
}

export function serializeStyle(style: StyleMap): string {
  return Object.entries(style)
    .map(([prop, value]) => `${prop}:${value}`)
    .join(";");
}

// --- Structural validation & serialization ---

export interface SanitizeOptions {
  width: number;
  height: number;
  hasLogo: boolean;
  /** Photo references declared on the mockup (`p1`…): only these are accepted as `src`. */
  imageRefs: string[];
}

export interface SanitizedSlide {
  html: string;
  layerCount: number;
  /** Identifiants data-layer des enfants directs, dans l'ordre — la ligne de temps s'y rattache. */
  layerIds: string[];
  /** Photo references actually used by the slide. */
  imageRefs: string[];
}

function serializeElement(el: DesignElement): string {
  const attrs = Object.entries(el.attrs)
    .map(([k, v]) => ` ${k}="${encodeAttr(v)}"`)
    .join("");
  if (VOID_TAGS.has(el.tag)) return `<${el.tag}${attrs}>`;
  const inner = el.children.map((c) => ("text" in c ? encodeText(c.text) : serializeElement(c))).join("");
  return `<${el.tag}${attrs}>${inner}</${el.tag}>`;
}

function walk(el: DesignElement, visit: (node: DesignElement, path: string) => void, path = el.tag) {
  visit(el, path);
  el.children.forEach((c, i) => {
    if ("tag" in c) walk(c, visit, `${path}>${c.tag}[${i}]`);
  });
}

/**
 * Validates and normalizes a slide's HTML. Throws DesignValidationError with the list of problems
 * (returned to the model for a second attempt, or as a 422 to a manual write).
 */
export function sanitizeSlideHtml(html: string, options: SanitizeOptions): SanitizedSlide {
  const issues: string[] = [];
  if (Buffer.byteLength(html, "utf8") > MAX_SLIDE_HTML_BYTES * 2) {
    throw new DesignValidationError([`HTML too large (${Math.round(Buffer.byteLength(html, "utf8") / 1024)} KB)`]);
  }
  const { root, issues: parseIssues } = new Parser(html.trim()).parseDocument();
  issues.push(...parseIssues);
  if (!root) throw new DesignValidationError(issues.length ? issues : ["no root element"]);
  if (root.tag !== "div") issues.push(`the root must be a <div>, not <${root.tag}>`);

  const usedImageRefs = new Set<string>();
  const layerIds = new Set<string>();

  // Attributes & styles of each element.
  walk(root, (node, path) => {
    for (const name of Object.keys(node.attrs)) {
      if (!ALLOWED_ATTRS.has(name)) {
        issues.push(`${path}: attribute "${name}" is forbidden`);
        delete node.attrs[name];
      }
    }
    if (node.tag === "img") {
      const src = node.attrs.src ?? "";
      const ref = parseImagePlaceholder(src);
      if (ref) {
        if (options.imageRefs.includes(ref)) usedImageRefs.add(ref);
        else issues.push(`${path}: photo "${ref}" not declared on this mockup`);
      } else if (src === LOGO_PLACEHOLDER) {
        if (!options.hasLogo) issues.push(`${path}: {{LOGO}} used without a defined logo`);
      } else issues.push(`${path}: image src forbidden (only {{IMG:p1}}… and {{LOGO}} are accepted)`);
      if (!node.attrs.alt) node.attrs.alt = "";
    } else if ("src" in node.attrs) {
      issues.push(`${path}: src on a <${node.tag}> tag`);
      delete node.attrs.src;
    }
    if (node.attrs.style !== undefined) {
      node.attrs.style = serializeStyle(parseStyle(node.attrs.style, issues, path));
    }
  });

  // Root: canvas size imposed.
  const rootRest = parseStyle(root.attrs.style ?? "", [], "root");
  for (const forced of ["position", "width", "height", "overflow", "transform"]) delete rootRest[forced];
  const rootStyle: StyleMap = {
    position: "relative",
    width: `${options.width}px`,
    height: `${options.height}px`,
    overflow: "hidden",
    ...rootRest,
  };
  root.attrs = { ...root.attrs, style: serializeStyle(rootStyle) };
  delete root.attrs["data-layer"];
  delete root.attrs["data-type"];

  // Layers: direct children, absolute, identified, typed.
  const layers: DesignElement[] = [];
  const keptChildren: DesignChild[] = [];
  root.children.forEach((child, i) => {
    if ("text" in child) {
      if (child.text.trim()) issues.push(`bare text under the root (child ${i}): put it in a layer`);
      return;
    }
    layers.push(child);
    keptChildren.push(child);
  });
  root.children = keptChildren;
  if (layers.length > MAX_LAYERS_PER_SLIDE) issues.push(`${layers.length} layers, ${MAX_LAYERS_PER_SLIDE} maximum`);
  layers.forEach((layer, i) => {
    const layerRest = parseStyle(layer.attrs.style ?? "", [], `layer ${i + 1}`);
    delete layerRest.position;
    layer.attrs.style = serializeStyle({ position: "absolute", ...layerRest });
    let id = (layer.attrs["data-layer"] ?? "").trim();
    if (!id || layerIds.has(id) || !/^[a-zA-Z0-9_-]{1,32}$/.test(id)) {
      id = `l${i + 1}`;
      while (layerIds.has(id)) id = `${id}x`;
    }
    layerIds.add(id);
    let type = (layer.attrs["data-type"] ?? "").trim().toLowerCase();
    if (!LAYER_TYPES.has(type)) {
      type = containsImage(layer) ? "image" : containsText(layer) ? "text" : "shape";
    }
    // Canonical attribute order, for stable serialization.
    layer.attrs = { "data-layer": id, "data-type": type, ...(layer.attrs.style ? { style: layer.attrs.style } : {}) };
    // Layer identifiers only make sense at the first level: cleaned at depth.
    layer.children.forEach((c) => {
      if ("tag" in c)
        walk(c, (nested) => {
          delete nested.attrs["data-layer"];
          delete nested.attrs["data-type"];
        });
    });
  });

  if (issues.length > 0) throw new DesignValidationError(issues);

  const serialized = serializeElement(root);
  if (Buffer.byteLength(serialized, "utf8") > MAX_SLIDE_HTML_BYTES) {
    throw new DesignValidationError([`HTML too large after normalization (${Math.round(Buffer.byteLength(serialized, "utf8") / 1024)} KB, max ${MAX_SLIDE_HTML_BYTES / 1024})`]);
  }
  return { html: serialized, layerCount: layers.length, layerIds: [...layerIds], imageRefs: [...usedImageRefs] };
}

function containsImage(el: DesignElement): boolean {
  if (el.tag === "img") return true;
  return el.children.some((c) => "tag" in c && containsImage(c));
}

function containsText(el: DesignElement): boolean {
  return el.children.some((c) => ("text" in c ? c.text.trim().length > 0 : containsText(c)));
}

/** Texte visible d'une slide (pour les vignettes et le titre de l'export). */
export function slidePlainText(html: string): string {
  const { root } = new Parser(html).parseDocument();
  if (!root) return "";
  const parts: string[] = [];
  const collect = (el: DesignElement) => {
    for (const c of el.children) {
      if ("text" in c) parts.push(c.text);
      else collect(c);
    }
  };
  collect(root);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

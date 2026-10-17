/**
 * Catalog of interface elements (docs/SPEC_COMPOSITION_VISUELLE.md §2 "Interface elements",
 * §5.4). No new layer type: each element is a `shape` or `text` layer made of
 * `div` + inline styles, expressible in the whitelist. The same catalog serves twice — as
 * text in the agent's system prompt, and as HTML in the editor's "Add an element" menu.
 * Pure module, tested against the whitelist.
 */

export interface UiElementTheme {
  /** Hex colors, the first dominant (DesignTheme.palette). */
  palette: string[];
  fontHeading: string;
  fontBody: string;
}

export interface UiElement {
  id: string;
  label: string;
  /** A sentence for the agent: what it is for, how it is built. */
  prompt: string;
  /** Ready-to-insert layer, centered by default; `data-layer` is set by the caller. */
  html: (theme: UiElementTheme, canvas: { width: number; height: number }) => string;
}

function colorAt(theme: UiElementTheme, index: number, fallback: string): string {
  return theme.palette[index] ?? theme.palette[0] ?? fallback;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const UI_ELEMENTS: UiElement[] = [
  {
    id: "price-tag",
    label: "Price tag",
    prompt: "price tag (pill or rounded rectangle in the brand colors, big price, short note below)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.72)}px;left:${Math.round(c.width * 0.62)}px;width:${Math.round(c.width * 0.3)}px;height:${Math.round(c.width * 0.14)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${esc(colorAt(t, 2, "#c98a3a"))};color:#fff;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-family:${esc(t.fontHeading)}"><span style="font-size:${Math.round(c.width * 0.05)}px;font-weight:700;line-height:1">$24</span><span style="font-size:${Math.round(c.width * 0.018)}px;font-family:${esc(t.fontBody)};opacity:0.9">free shipping</span></div>`,
  },
  {
    id: "badge",
    label: "Badge",
    prompt: "badge (small capsule at the top of a slide: \"New\", \"Limited edition\", \"-20%\")",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.06)}px;left:${Math.round(c.width * 0.06)}px;padding:${Math.round(c.width * 0.012)}px ${Math.round(c.width * 0.025)}px;background:${esc(colorAt(t, 0, "#111"))};color:#fff;border-radius:999px;font-family:${esc(t.fontBody)};font-size:${Math.round(c.width * 0.024)}px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">New</div>`,
  },
  {
    id: "cta-button",
    label: "Call-to-action button",
    prompt: "call-to-action button (solid rounded rectangle, short centered text, at the bottom of the last slide)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.84)}px;left:${Math.round(c.width * 0.2)}px;width:${Math.round(c.width * 0.6)}px;height:${Math.round(c.width * 0.1)}px;display:flex;align-items:center;justify-content:center;background:${esc(colorAt(t, 2, "#c98a3a"))};color:#fff;border-radius:${Math.round(c.width * 0.02)}px;font-family:${esc(t.fontHeading)};font-size:${Math.round(c.width * 0.034)}px;font-weight:700">Order now</div>`,
  },
  {
    id: "numbered-bullet",
    label: "Numbered bullet",
    prompt: "numbered bullet (solid circle with a digit, text on the right — for a list of steps or arguments)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.4)}px;left:${Math.round(c.width * 0.08)}px;width:${Math.round(c.width * 0.84)}px;display:flex;align-items:center;gap:${Math.round(c.width * 0.025)}px;font-family:${esc(t.fontBody)};color:${esc(colorAt(t, 1, "#fff"))}"><span style="display:flex;align-items:center;justify-content:center;width:${Math.round(c.width * 0.08)}px;height:${Math.round(c.width * 0.08)}px;border-radius:50%;background:${esc(colorAt(t, 2, "#c98a3a"))};color:#fff;font-family:${esc(t.fontHeading)};font-size:${Math.round(c.width * 0.04)}px;font-weight:700">1</span><span style="font-size:${Math.round(c.width * 0.034)}px;line-height:1.3">First step</span></div>`,
  },
  {
    id: "card",
    label: "Card",
    prompt: "card / callout (semi-opaque rounded rectangle that isolates a text over a busy photo)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.55)}px;left:${Math.round(c.width * 0.08)}px;width:${Math.round(c.width * 0.84)}px;padding:${Math.round(c.width * 0.04)}px;background:rgba(255,255,255,0.92);color:${esc(colorAt(t, 0, "#111"))};border-radius:${Math.round(c.width * 0.025)}px;box-shadow:0 12px 32px rgba(0,0,0,0.2);font-family:${esc(t.fontBody)};font-size:${Math.round(c.width * 0.03)}px;line-height:1.35">A short text, highlighted in a card.</div>`,
  },
  {
    id: "banner",
    label: "Banner",
    prompt: "banner (full-width bar at the top or bottom, brand color, title or note inside)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:0;left:0;width:${c.width}px;height:${Math.round(c.height * 0.1)}px;display:flex;align-items:center;justify-content:center;background:${esc(colorAt(t, 0, "#111"))};color:#fff;font-family:${esc(t.fontHeading)};font-size:${Math.round(c.width * 0.036)}px;font-weight:700;letter-spacing:0.02em">Banner title</div>`,
  },
  {
    id: "quote-bubble",
    label: "Quote bubble",
    prompt: "quote bubble (rounded card with a large quotation mark and the author's name, for a customer review)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.3)}px;left:${Math.round(c.width * 0.1)}px;width:${Math.round(c.width * 0.8)}px;padding:${Math.round(c.width * 0.05)}px;background:${esc(colorAt(t, 1, "#f4e9d8"))};color:${esc(colorAt(t, 0, "#111"))};border-radius:${Math.round(c.width * 0.04)}px;font-family:${esc(t.fontHeading)};font-size:${Math.round(c.width * 0.034)}px;line-height:1.35"><span style="display:block;font-size:${Math.round(c.width * 0.1)}px;line-height:0.8;opacity:0.5">“</span>A customer review, short and sincere.<span style="display:block;margin-top:${Math.round(c.width * 0.02)}px;font-family:${esc(t.fontBody)};font-size:${Math.round(c.width * 0.024)}px;opacity:0.7">— First name</span></div>`,
  },
  {
    id: "divider",
    label: "Divider",
    prompt: "divider (thin horizontal line, accent color, between two blocks of text)",
    html: (t, c) =>
      `<div data-type="shape" style="position:absolute;top:${Math.round(c.height * 0.5)}px;left:${Math.round(c.width * 0.3)}px;width:${Math.round(c.width * 0.4)}px;height:${Math.max(3, Math.round(c.width * 0.004))}px;background:${esc(colorAt(t, 2, "#c98a3a"))};border-radius:999px"></div>`,
  },
  {
    id: "progress-bar",
    label: "Progress bar",
    prompt: "progress bar (light track and filled portion, for \"step 3 of 5\" or a percentage)",
    html: (t, c) =>
      `<div data-type="shape" style="position:absolute;top:${Math.round(c.height * 0.9)}px;left:${Math.round(c.width * 0.1)}px;width:${Math.round(c.width * 0.8)}px;height:${Math.round(c.width * 0.014)}px;background:rgba(255,255,255,0.35);border-radius:999px;overflow:hidden"><div style="width:60%;height:100%;background:${esc(colorAt(t, 2, "#c98a3a"))};border-radius:999px"></div></div>`,
  },
  {
    id: "phone-frame",
    label: "Phone frame",
    prompt: "phone frame (vertical rectangle with very rounded corners, thick dark border, notch at the top; the screenshot goes inside with object-fit:cover)",
    html: (t, c) => {
      const w = Math.round(c.width * 0.5);
      const h = Math.round(w * 2.05);
      return `<div data-type="shape" style="position:absolute;top:${Math.round((c.height - h) / 2)}px;left:${Math.round((c.width - w) / 2)}px;width:${w}px;height:${h}px;background:#0f0f10;border-radius:${Math.round(w * 0.14)}px;padding:${Math.round(w * 0.035)}px;box-sizing:border-box;box-shadow:0 24px 48px rgba(0,0,0,0.35)"><div style="width:100%;height:100%;background:${esc(colorAt(t, 1, "#f4e9d8"))};border-radius:${Math.round(w * 0.11)}px;overflow:hidden;position:relative"><div style="position:absolute;top:${Math.round(w * 0.03)}px;left:50%;width:${Math.round(w * 0.3)}px;height:${Math.round(w * 0.06)}px;margin-left:-${Math.round(w * 0.15)}px;background:#0f0f10;border-radius:999px"></div></div></div>`;
    },
  },
  {
    id: "browser-frame",
    label: "Browser frame",
    prompt: "browser frame (rounded-corner rectangle, light top bar with three round dots on the left; the screenshot goes inside)",
    html: (t, c) => {
      const w = Math.round(c.width * 0.86);
      const h = Math.round(w * 0.66);
      const bar = Math.round(w * 0.05);
      const dot = Math.round(bar * 0.35);
      return `<div data-type="shape" style="position:absolute;top:${Math.round((c.height - h) / 2)}px;left:${Math.round((c.width - w) / 2)}px;width:${w}px;height:${h}px;background:#fff;border-radius:${Math.round(w * 0.02)}px;overflow:hidden;box-shadow:0 20px 48px rgba(0,0,0,0.3)"><div style="height:${bar}px;background:#e9e6e1;display:flex;align-items:center;gap:${Math.round(dot * 0.6)}px;padding-left:${Math.round(bar * 0.4)}px"><span style="width:${dot}px;height:${dot}px;border-radius:50%;background:#ff5f57"></span><span style="width:${dot}px;height:${dot}px;border-radius:50%;background:#febc2e"></span><span style="width:${dot}px;height:${dot}px;border-radius:50%;background:#28c840"></span></div><div style="height:${h - bar}px;background:${esc(colorAt(t, 1, "#f4e9d8"))}"></div></div>`;
    },
  },
];

export function findUiElement(id: string): UiElement | null {
  return UI_ELEMENTS.find((e) => e.id === id) ?? null;
}

/** One-line enumeration for the agent's system prompt. */
export function describeUiElementsForPrompt(): string {
  return UI_ELEMENTS.map((e) => e.prompt).join(" ; ");
}

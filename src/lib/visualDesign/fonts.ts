/**
 * Design fonts (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 "Fonts") — closed list, loaded by
 * next/font/google in the root layout (src/app/layout.tsx) under CSS variables. The stored
 * HTML carries the readable name (`font-family: Inter`), which is what the model writes and rereads;
 * rendering translates it into `var(--font-design-…)` (toRenderableHtml, client) and the export
 * embeds it via next/font's @font-face rules, served same-origin.
 */
export interface DesignFont {
  /** Name the model and the author manipulate. */
  name: string;
  /** CSS variable set by next/font on <html>. */
  cssVariable: string;
  /** Famille de repli si la variable est absente (rendu hors app, ex. test). */
  fallback: string;
  role: "sans" | "serif" | "display" | "handwriting" | "mono";
}

export const DESIGN_FONTS: DesignFont[] = [
  { name: "Inter", cssVariable: "--font-design-inter", fallback: "system-ui, sans-serif", role: "sans" },
  { name: "Space Grotesk", cssVariable: "--font-design-space-grotesk", fallback: "system-ui, sans-serif", role: "sans" },
  { name: "Playfair Display", cssVariable: "--font-design-playfair", fallback: "Georgia, serif", role: "serif" },
  { name: "DM Serif Display", cssVariable: "--font-design-dm-serif", fallback: "Georgia, serif", role: "display" },
  { name: "Caveat", cssVariable: "--font-design-caveat", fallback: "cursive", role: "handwriting" },
  { name: "JetBrains Mono", cssVariable: "--font-design-jetbrains-mono", fallback: "monospace", role: "mono" },
];

const BY_NORMALIZED_NAME = new Map(DESIGN_FONTS.map((f) => [f.name.toLowerCase(), f]));

/** Resolves a `font-family` value written by the model (quotes, case, fallback after a comma) to a known font. */
export function resolveDesignFont(fontFamilyValue: string): DesignFont | null {
  const first = fontFamilyValue.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "").toLowerCase() ?? "";
  return BY_NORMALIZED_NAME.get(first) ?? null;
}

export function designFontNames(): string[] {
  return DESIGN_FONTS.map((f) => f.name);
}

/** `font-family: Inter` → `font-family: var(--font-design-inter), system-ui, sans-serif` — rendu et export. */
export function toRenderableFontFamily(name: string): string {
  const font = BY_NORMALIZED_NAME.get(name.toLowerCase());
  if (!font) return name;
  return `var(${font.cssVariable}), ${font.fallback}`;
}

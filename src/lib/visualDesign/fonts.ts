/**
 * Polices du design (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2 « Polices ») — liste fermée, chargée par
 * next/font/google dans le layout racine (src/app/layout.tsx) sous des variables CSS. Le HTML
 * stocké porte le nom lisible (`font-family: Inter`), c'est ce que le modèle écrit et relit ; le
 * rendu le traduit en `var(--font-design-…)` (toRenderableHtml, client) et l'export l'embarque via
 * les @font-face de next/font, servies same-origin.
 */
export interface DesignFont {
  /** Nom que le modèle et l'auteur manipulent. */
  name: string;
  /** Variable CSS posée par next/font sur <html>. */
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

/** Résout une valeur `font-family` écrite par le modèle (guillemets, casse, repli après virgule) vers une police connue. */
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

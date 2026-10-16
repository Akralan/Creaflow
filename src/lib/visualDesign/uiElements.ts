/**
 * Catalogue d'éléments d'interface (docs/SPEC_COMPOSITION_VISUELLE.md §2 « Éléments d'interface »,
 * §5.4). Pas de nouveau type de calque : chaque élément est un calque `shape` ou `text` fait de
 * `div` + styles inline, exprimable dans la liste blanche. Le même catalogue sert deux fois — en
 * texte dans le system prompt de l'agent, et en HTML dans le menu « Ajouter un élément » de
 * l'éditeur. Module pur, testé contre la liste blanche.
 */

export interface UiElementTheme {
  /** Couleurs hex, la première dominante (DesignTheme.palette). */
  palette: string[];
  fontHeading: string;
  fontBody: string;
}

export interface UiElement {
  id: string;
  label: string;
  /** Une phrase pour l'agent : à quoi ça sert, comment ça se construit. */
  prompt: string;
  /** Calque prêt à insérer, centré par défaut ; `data-layer` est posé par l'appelant. */
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
    label: "Étiquette de prix",
    prompt: "étiquette de prix (pastille ou rectangle arrondi aux couleurs de la marque, prix en gros, mention courte en dessous)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.72)}px;left:${Math.round(c.width * 0.62)}px;width:${Math.round(c.width * 0.3)}px;height:${Math.round(c.width * 0.14)}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${esc(colorAt(t, 2, "#c98a3a"))};color:#fff;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,0.25);font-family:${esc(t.fontHeading)}"><span style="font-size:${Math.round(c.width * 0.05)}px;font-weight:700;line-height:1">24 €</span><span style="font-size:${Math.round(c.width * 0.018)}px;font-family:${esc(t.fontBody)};opacity:0.9">livraison offerte</span></div>`,
  },
  {
    id: "badge",
    label: "Badge",
    prompt: "badge (petite capsule en haut d'une slide : « Nouveau », « Édition limitée », « -20 % »)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.06)}px;left:${Math.round(c.width * 0.06)}px;padding:${Math.round(c.width * 0.012)}px ${Math.round(c.width * 0.025)}px;background:${esc(colorAt(t, 0, "#111"))};color:#fff;border-radius:999px;font-family:${esc(t.fontBody)};font-size:${Math.round(c.width * 0.024)}px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Nouveau</div>`,
  },
  {
    id: "cta-button",
    label: "Bouton d'appel à l'action",
    prompt: "bouton d'appel à l'action (rectangle arrondi plein, texte court centré, en bas de la dernière slide)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.84)}px;left:${Math.round(c.width * 0.2)}px;width:${Math.round(c.width * 0.6)}px;height:${Math.round(c.width * 0.1)}px;display:flex;align-items:center;justify-content:center;background:${esc(colorAt(t, 2, "#c98a3a"))};color:#fff;border-radius:${Math.round(c.width * 0.02)}px;font-family:${esc(t.fontHeading)};font-size:${Math.round(c.width * 0.034)}px;font-weight:700">Commander</div>`,
  },
  {
    id: "numbered-bullet",
    label: "Puce numérotée",
    prompt: "puce numérotée (rond plein avec un chiffre, texte à droite — pour une liste d'étapes ou d'arguments)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.4)}px;left:${Math.round(c.width * 0.08)}px;width:${Math.round(c.width * 0.84)}px;display:flex;align-items:center;gap:${Math.round(c.width * 0.025)}px;font-family:${esc(t.fontBody)};color:${esc(colorAt(t, 1, "#fff"))}"><span style="display:flex;align-items:center;justify-content:center;width:${Math.round(c.width * 0.08)}px;height:${Math.round(c.width * 0.08)}px;border-radius:50%;background:${esc(colorAt(t, 2, "#c98a3a"))};color:#fff;font-family:${esc(t.fontHeading)};font-size:${Math.round(c.width * 0.04)}px;font-weight:700">1</span><span style="font-size:${Math.round(c.width * 0.034)}px;line-height:1.3">Première étape</span></div>`,
  },
  {
    id: "card",
    label: "Encart",
    prompt: "encart / carte (rectangle arrondi semi-opaque qui isole un texte sur une photo chargée)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.55)}px;left:${Math.round(c.width * 0.08)}px;width:${Math.round(c.width * 0.84)}px;padding:${Math.round(c.width * 0.04)}px;background:rgba(255,255,255,0.92);color:${esc(colorAt(t, 0, "#111"))};border-radius:${Math.round(c.width * 0.025)}px;box-shadow:0 12px 32px rgba(0,0,0,0.2);font-family:${esc(t.fontBody)};font-size:${Math.round(c.width * 0.03)}px;line-height:1.35">Un texte court, mis en valeur dans un encart.</div>`,
  },
  {
    id: "banner",
    label: "Bandeau",
    prompt: "bandeau (barre pleine largeur en haut ou en bas, couleur de marque, titre ou mention dedans)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:0;left:0;width:${c.width}px;height:${Math.round(c.height * 0.1)}px;display:flex;align-items:center;justify-content:center;background:${esc(colorAt(t, 0, "#111"))};color:#fff;font-family:${esc(t.fontHeading)};font-size:${Math.round(c.width * 0.036)}px;font-weight:700;letter-spacing:0.02em">Titre du bandeau</div>`,
  },
  {
    id: "quote-bubble",
    label: "Bulle de citation",
    prompt: "bulle de citation (encart arrondi avec un grand guillemet et le nom de l'auteur, pour un avis client)",
    html: (t, c) =>
      `<div data-type="text" style="position:absolute;top:${Math.round(c.height * 0.3)}px;left:${Math.round(c.width * 0.1)}px;width:${Math.round(c.width * 0.8)}px;padding:${Math.round(c.width * 0.05)}px;background:${esc(colorAt(t, 1, "#f4e9d8"))};color:${esc(colorAt(t, 0, "#111"))};border-radius:${Math.round(c.width * 0.04)}px;font-family:${esc(t.fontHeading)};font-size:${Math.round(c.width * 0.034)}px;line-height:1.35"><span style="display:block;font-size:${Math.round(c.width * 0.1)}px;line-height:0.8;opacity:0.5">“</span>Un avis client, court et sincère.<span style="display:block;margin-top:${Math.round(c.width * 0.02)}px;font-family:${esc(t.fontBody)};font-size:${Math.round(c.width * 0.024)}px;opacity:0.7">— Prénom</span></div>`,
  },
  {
    id: "divider",
    label: "Séparateur",
    prompt: "séparateur (trait fin horizontal, couleur d'accent, entre deux blocs de texte)",
    html: (t, c) =>
      `<div data-type="shape" style="position:absolute;top:${Math.round(c.height * 0.5)}px;left:${Math.round(c.width * 0.3)}px;width:${Math.round(c.width * 0.4)}px;height:${Math.max(3, Math.round(c.width * 0.004))}px;background:${esc(colorAt(t, 2, "#c98a3a"))};border-radius:999px"></div>`,
  },
  {
    id: "progress-bar",
    label: "Barre de progression",
    prompt: "barre de progression (rail clair et portion pleine, pour « 3 étapes sur 5 » ou un pourcentage)",
    html: (t, c) =>
      `<div data-type="shape" style="position:absolute;top:${Math.round(c.height * 0.9)}px;left:${Math.round(c.width * 0.1)}px;width:${Math.round(c.width * 0.8)}px;height:${Math.round(c.width * 0.014)}px;background:rgba(255,255,255,0.35);border-radius:999px;overflow:hidden"><div style="width:60%;height:100%;background:${esc(colorAt(t, 2, "#c98a3a"))};border-radius:999px"></div></div>`,
  },
  {
    id: "phone-frame",
    label: "Cadre de téléphone",
    prompt: "cadre de téléphone (rectangle vertical à coins très arrondis, bordure sombre épaisse, encoche en haut ; la capture d'écran va dedans en object-fit:cover)",
    html: (t, c) => {
      const w = Math.round(c.width * 0.5);
      const h = Math.round(w * 2.05);
      return `<div data-type="shape" style="position:absolute;top:${Math.round((c.height - h) / 2)}px;left:${Math.round((c.width - w) / 2)}px;width:${w}px;height:${h}px;background:#0f0f10;border-radius:${Math.round(w * 0.14)}px;padding:${Math.round(w * 0.035)}px;box-sizing:border-box;box-shadow:0 24px 48px rgba(0,0,0,0.35)"><div style="width:100%;height:100%;background:${esc(colorAt(t, 1, "#f4e9d8"))};border-radius:${Math.round(w * 0.11)}px;overflow:hidden;position:relative"><div style="position:absolute;top:${Math.round(w * 0.03)}px;left:50%;width:${Math.round(w * 0.3)}px;height:${Math.round(w * 0.06)}px;margin-left:-${Math.round(w * 0.15)}px;background:#0f0f10;border-radius:999px"></div></div></div>`;
    },
  },
  {
    id: "browser-frame",
    label: "Cadre de navigateur",
    prompt: "cadre de navigateur (rectangle à coins arrondis, barre haute claire avec trois points ronds à gauche ; la capture d'écran va dedans)",
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

/** Énumération en une ligne pour le system prompt de l'agent. */
export function describeUiElementsForPrompt(): string {
  return UI_ELEMENTS.map((e) => e.prompt).join(" ; ");
}

import { accent, accentAlpha } from "@/lib/design/tokens";

/**
 * Exact values from the source design (Claude Design, creaflow-landing-v2) for this landing
 * page. `accent`/`accentAlpha` from src/lib/design/tokens.ts match the design values
 * (oklch(0.55 0.2 292)) and are re-exported as is. All the other shades
 * (backgrounds, text, accent hover...) are specific to this design and do NOT match the
 * existing global tokens (e.g. color.text in tokens.ts is #1c1917, different from the #221d19 /
 * #1b1713 used here) — so they live here rather than in tokens.ts, which serves the rest
 * of the app (calendar, script editor, etc.).
 */
export { accent, accentAlpha };

/** oklch(0.49 0.19 292) — distinct from the global accentHover (oklch(0.45 0.2 292)). */
export const accentHover = "oklch(0.49 0.19 292)";
/** "Accent" text color (badges, conversation links) of the source design. */
export const accentText = "#4d3778";

export const bg = {
  page: "#f7f4ef",
  card: "#fffdfa",
  soft1: "#f4f0e9",
  soft2: "#f3efe8",
  soft3: "#f1ece4",
  track: "#f0ebe3",
};

export const text = {
  body: "#221d19",
  heading: "#1b1713",
  secondary: "#574d45",
  muted: "#6d6259",
  faint: "#8a7f74",
  fainter: "#a2988c",
};

/** rgba(34,29,25,alpha) — neutral borders/overlays of the source design. */
export function ink(alpha: number): string {
  return `rgba(34,29,25,${alpha})`;
}

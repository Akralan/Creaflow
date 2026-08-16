import { accent, accentAlpha } from "@/lib/design/tokens";

/**
 * Valeurs exactes du design source (Claude Design, creaflow-landing-v2) pour cette landing
 * page. `accent`/`accentAlpha` de src/lib/design/tokens.ts coïncident avec les valeurs du
 * design (oklch(0.55 0.2 292)) et sont réexportés tels quels. Toutes les autres teintes
 * (fonds, textes, survol accent...) sont propres à ce design et ne correspondent PAS aux
 * tokens globaux existants (ex. color.text de tokens.ts est #1c1917, différent du #221d19 /
 * #1b1713 utilisés ici) — elles vivent donc ici plutôt que dans tokens.ts, qui sert au reste
 * de l'app (calendrier, éditeur de script, etc.).
 */
export { accent, accentAlpha };

/** oklch(0.49 0.19 292) — distinct de accentHover global (oklch(0.45 0.2 292)). */
export const accentHover = "oklch(0.49 0.19 292)";
/** Couleur de texte "accentuée" (badges, liens de conversation) du design source. */
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

/** rgba(34,29,25,alpha) — bordures/superpositions neutres du design source. */
export function ink(alpha: number): string {
  return `rgba(34,29,25,${alpha})`;
}

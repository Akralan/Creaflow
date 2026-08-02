export const accent = "oklch(0.55 0.2 292)";
export const accentHover = "oklch(0.45 0.2 292)";
export const accentText = "oklch(0.47 0.2 292)";
export const accentIcon = "oklch(0.5 0.2 292)";

export function accentAlpha(alpha: number): string {
  return `oklch(0.55 0.2 292 / ${alpha})`;
}

export const color = {
  pageBg: "#f7f4ef",
  cardBg: "#fff",
  inputBg: "#faf8f4",
  listItemBg: "#fdfcfa",
  border: "#e8e2d9",
  inputBorder: "#e2dbd0",
  divider: "#efe9e0",
  dividerAlt: "#eee7dd",
  trackBg: "#f0eae1",
  dashedBorder: "#cfc6ba",
  chipBg: "#f2ede5",
  text: "#1c1917",
  text2: "#2a2521",
  text3: "#3a342f",
  textSecondary: "#57504a",
  textMuted: "#78706a",
  textFaint: "#a09890",
  textFainter: "#9a9088",
  textPlaceholder: "#c9c0b4",
  danger: "#b04a3a",
  dangerBorder: "#ecd6d0",
  successDot: "oklch(0.62 0.14 150)",
};

export const fontHeading = "'Bricolage Grotesque', system-ui, sans-serif";
export const fontBody = "'Instrument Sans', system-ui, sans-serif";

export type Platform = string;
export type ScriptStatus = "draft" | "planned" | "shot" | "published";
export type CalendarStatus = "planned" | "shot" | "published";

/** Palette assignée par position (hash de l'id) aux catégories de contenu dynamiques —
 *  il n'y a plus de clé stable (vente/coulisses/educatif) à mapper vers une couleur fixe. */
export const categoryPalette: Array<{ base: string; bg: string; border: string; fg: string }> = [
  { base: "oklch(0.62 0.15 25)", bg: "oklch(0.62 0.15 25 / 0.12)", border: "oklch(0.62 0.15 25 / 0.28)", fg: "oklch(0.5 0.16 25)" },
  { base: "oklch(0.62 0.12 250)", bg: "oklch(0.62 0.12 250 / 0.12)", border: "oklch(0.62 0.12 250 / 0.28)", fg: "oklch(0.45 0.14 250)" },
  { base: "oklch(0.62 0.13 150)", bg: "oklch(0.62 0.13 150 / 0.12)", border: "oklch(0.62 0.13 150 / 0.28)", fg: "oklch(0.42 0.14 150)" },
  { base: "oklch(0.62 0.13 60)", bg: "oklch(0.62 0.13 60 / 0.12)", border: "oklch(0.62 0.13 60 / 0.28)", fg: "oklch(0.5 0.13 60)" },
  { base: "oklch(0.55 0.2 292)", bg: "oklch(0.55 0.2 292 / 0.1)", border: "oklch(0.55 0.2 292 / 0.25)", fg: "oklch(0.47 0.2 292)" },
  { base: "oklch(0.6 0.14 340)", bg: "oklch(0.6 0.14 340 / 0.12)", border: "oklch(0.6 0.14 340 / 0.28)", fg: "oklch(0.5 0.15 340)" },
];

/** Couvre toutes les clés de KNOWN_PLATFORMS (src/lib/social/types.ts) — PlatformBadge
 *  applique un repli générique si une plateforme inconnue devait malgré tout apparaître. */
export const platformMeta: Record<string, { label: string; badge: string; badgeBg: string }> = {
  tiktok: { label: "TikTok", badge: "TT", badgeBg: "#111" },
  instagram: { label: "Instagram", badge: "IG", badgeBg: "oklch(0.6 0.2 15)" },
  linkedin: { label: "LinkedIn", badge: "IN", badgeBg: "oklch(0.5 0.14 250)" },
  x: { label: "X (Twitter)", badge: "X", badgeBg: "#000" },
  youtube: { label: "YouTube", badge: "YT", badgeBg: "oklch(0.55 0.2 25)" },
  newsletter: { label: "Newsletter", badge: "NL", badgeBg: "oklch(0.55 0.12 250)" },
  blog: { label: "Blog / site perso", badge: "BL", badgeBg: "oklch(0.5 0.1 150)" },
  other: { label: "Autre", badge: "?", badgeBg: "#6b6259" },
};

export const genericPlatformMeta = { badge: "?", badgeBg: "#6b6259" };

export const statusMeta: Record<ScriptStatus, { label: string; bg: string; fg: string }> = {
  draft: { label: "Brouillon", bg: color.trackBg, fg: "#8a8078" },
  planned: { label: "Planifié", bg: accentAlpha(0.14), fg: accentText },
  shot: { label: "Tourné", bg: "oklch(0.62 0.13 60 / 0.16)", fg: "oklch(0.5 0.13 60)" },
  published: { label: "Publié", bg: "oklch(0.62 0.13 150 / 0.16)", fg: "oklch(0.42 0.14 150)" },
};

export const calendarStatusMeta: Record<CalendarStatus, { label: string; bg: string; fg: string }> = {
  planned: statusMeta.planned,
  shot: statusMeta.shot,
  published: statusMeta.published,
};

export const scriptStatusOptions: ScriptStatus[] = ["draft", "planned", "shot", "published"];

import { z } from "zod";

/**
 * Profil de style d'un auteur (docs/SPEC_APPRENTISSAGE_STYLE.md §2). Deux couches :
 * - la VOIX : les quatre descripteurs historiques + `summary`, hérités de l'analyse des légendes ;
 * - les CORRECTIONS : `rules` / `avoid` / `prefer`, apprises de l'écart premier jet / version finale.
 *
 * Rétrocompatible : un profil stocké avant ce chantier n'a ni rules ni avoid ni prefer — les
 * `.default(...)` les font valoir vides à la lecture, aucune migration de données.
 */
export const styleRuleSchema = z.object({
  text: z.string().trim().min(1).max(140),
  // Non null seulement si la règle ne vaut que pour cette plateforme (clé de KNOWN_PLATFORMS).
  platform: z.string().nullable().default(null),
});
export type StyleRule = z.infer<typeof styleRuleSchema>;

export const MAX_STYLE_RULES = 12;
export const MAX_STYLE_LIST_ITEMS = 15;

export const styleProfileSchema = z.object({
  tone: z.string().min(1),
  sentenceLength: z.string().min(1),
  emojiUsage: z.string().min(1),
  vocabulary: z.string().min(1),
  summary: z.string().min(1),
  rules: z.array(styleRuleSchema).max(MAX_STYLE_RULES).default([]),
  avoid: z.array(z.string().trim().min(1)).max(MAX_STYLE_LIST_ITEMS).default([]),
  prefer: z.array(z.string().trim().min(1)).max(MAX_STYLE_LIST_ITEMS).default([]),
  evidence: z
    .object({
      scriptCount: z.number().int().nonnegative(),
      learnedAt: z.string().nullable(),
    })
    .default({ scriptCount: 0, learnedAt: null }),
});

export type StyleProfile = z.infer<typeof styleProfileSchema>;

/** Lecture tolérante d'un jsonb `creatorProfiles.styleProfile` : null si absent ou illisible. */
export function parseStoredStyleProfile(raw: unknown): StyleProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const result = styleProfileSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Bloc `=== STYLE ===` injecté partout où la machine rédige à la place de l'auteur
 * (docs/SPEC_APPRENTISSAGE_STYLE.md §5.4) : génération complète, autre idée, régénération de bloc,
 * sélection→instruction. Chaîne vide si rien à dire. Une règle rattachée à une plateforme n'est
 * injectée que sur cette plateforme.
 */
export function buildStyleBlock(profile: StyleProfile | null | undefined, platform: string | null | undefined): string {
  if (!profile) return "";
  const lines: string[] = [];
  if (profile.summary) lines.push(`Voix : ${profile.summary}`);
  const rules = profile.rules.filter((r) => !r.platform || r.platform === platform);
  if (rules.length > 0) {
    lines.push("Règles à respecter (apprises des corrections de l'auteur, non négociables) :");
    for (const rule of rules) lines.push(`- ${rule.text}`);
  }
  if (profile.avoid.length > 0) lines.push(`À bannir : ${profile.avoid.join(", ")}`);
  if (profile.prefer.length > 0) lines.push(`À privilégier : ${profile.prefer.join(", ")}`);
  if (lines.length === 0) return "";
  return `=== STYLE ===\n${lines.join("\n")}`;
}

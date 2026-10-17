import { z } from "zod";

/**
 * An author's style profile (docs/SPEC_APPRENTISSAGE_STYLE.md §2). Two layers:
 * - the VOICE: the four historical descriptors + `summary`, inherited from the caption analysis;
 * - the CORRECTIONS: `rules` / `avoid` / `prefer`, learned from the gap between first draft and final version.
 *
 * Backward compatible: a profile stored before this feature has no rules, avoid or prefer — the
 * `.default(...)` make them empty on read, no data migration.
 */
export const styleRuleSchema = z.object({
  text: z.string().trim().min(1).max(140),
  // Non-null only if the rule applies to that platform alone (key of KNOWN_PLATFORMS).
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

/** Tolerant read of a `creatorProfiles.styleProfile` jsonb: null if absent or unreadable. */
export function parseStoredStyleProfile(raw: unknown): StyleProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const result = styleProfileSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * `=== STYLE ===` block injected wherever the machine writes in the author's place
 * (docs/SPEC_APPRENTISSAGE_STYLE.md §5.4): full generation, another idea, block regeneration,
 * selection→instruction. Empty string if nothing to say. A rule attached to a platform is only
 * injected on that platform.
 */
export function buildStyleBlock(profile: StyleProfile | null | undefined, platform: string | null | undefined): string {
  if (!profile) return "";
  const lines: string[] = [];
  if (profile.summary) lines.push(`Voice: ${profile.summary}`);
  const rules = profile.rules.filter((r) => !r.platform || r.platform === platform);
  if (rules.length > 0) {
    lines.push("Rules to follow (learned from the author's corrections, non-negotiable):");
    for (const rule of rules) lines.push(`- ${rule.text}`);
  }
  if (profile.avoid.length > 0) lines.push(`Avoid: ${profile.avoid.join(", ")}`);
  if (profile.prefer.length > 0) lines.push(`Prefer: ${profile.prefer.join(", ")}`);
  if (lines.length === 0) return "";
  return `=== STYLE ===\n${lines.join("\n")}`;
}

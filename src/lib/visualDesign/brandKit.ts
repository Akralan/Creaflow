import { z } from "zod";
import { resolveDesignFont } from "./fonts";

/**
 * Identité de marque pour les maquettes (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2) — portée par
 * `creatorProfiles.brandKit`. Tout est optionnel : l'agent complète ce qui manque.
 */
const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Couleur attendue au format #RRGGBB.")
  .nullable();

const designFontName = z
  .string()
  .trim()
  .refine((v) => resolveDesignFont(v) !== null, "Police hors liste.")
  .transform((v) => resolveDesignFont(v)!.name)
  .nullable();

export const brandKitSchema = z.object({
  primaryColor: hexColor.default(null),
  secondaryColor: hexColor.default(null),
  accentColor: hexColor.default(null),
  fontHeading: designFontName.default(null),
  fontBody: designFontName.default(null),
  logoAssetId: z.uuid().nullable().default(null),
});

export type BrandKit = z.infer<typeof brandKitSchema>;

export function parseStoredBrandKit(raw: unknown): BrandKit | null {
  if (!raw || typeof raw !== "object") return null;
  const result = brandKitSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Ligne injectée dans le prompt ; vide si le kit ne dit rien. */
export function describeBrandKit(kit: BrandKit | null): string {
  if (!kit) return "";
  const parts: string[] = [];
  const colors = [kit.primaryColor, kit.secondaryColor, kit.accentColor].filter((c): c is string => Boolean(c));
  if (colors.length) parts.push(`couleurs ${colors.join(", ")} (dominante en premier)`);
  if (kit.fontHeading) parts.push(`police des titres ${kit.fontHeading}`);
  if (kit.fontBody) parts.push(`police du texte ${kit.fontBody}`);
  if (kit.logoAssetId) parts.push("un logo est disponible via {{LOGO}}");
  return parts.join(" · ");
}

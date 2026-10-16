import { z } from "zod";

/**
 * Photos d'une maquette (docs/SPEC_COMPOSITION_VISUELLE.md §1, §4) : une maquette référence 0 à 6
 * photos de la bibliothèque, chacune affichée telle quelle ou détourée. Le HTML les désigne par
 * `{{IMG:p1}}`… ; le client et la route same-origin résolvent la référence en octets. Module pur,
 * partagé par la liste blanche, les prompts, le service et l'éditeur.
 */

export const MAX_DESIGN_IMAGES = 6;

export const DESIGN_IMAGE_VARIANTS = ["original", "cutout"] as const;
export type DesignImageVariant = (typeof DESIGN_IMAGE_VARIANTS)[number];

const REF_RE = /^p[1-6]$/;

export const designImageSchema = z.object({
  ref: z.string().regex(REF_RE, "référence de photo invalide (p1 à p6)"),
  assetId: z.uuid(),
  variant: z.enum(DESIGN_IMAGE_VARIANTS),
});
export type DesignImage = z.infer<typeof designImageSchema>;

export const designImagesSchema = z
  .array(designImageSchema)
  .max(MAX_DESIGN_IMAGES, `${MAX_DESIGN_IMAGES} photos maximum par maquette`)
  .refine((list) => new Set(list.map((i) => i.ref)).size === list.length, { message: "références de photo en double" })
  .refine((list) => new Set(list.map((i) => i.assetId)).size === list.length, { message: "une même photo ne peut être déclarée deux fois" });

export function imagePlaceholder(ref: string): string {
  return `{{IMG:${ref}}}`;
}

const PLACEHOLDER_RE = /\{\{IMG:(p[1-6])\}\}/g;

/** `{{IMG:p2}}` → `p2`, sinon null. */
export function parseImagePlaceholder(src: string): string | null {
  const m = /^\{\{IMG:(p[1-6])\}\}$/.exec(src.trim());
  return m ? m[1] : null;
}

/** Références de photo utilisées dans un HTML (dédoublonnées, dans l'ordre d'apparition). */
export function collectImageRefs(html: string): string[] {
  const refs: string[] = [];
  for (const m of html.matchAll(PLACEHOLDER_RE)) {
    if (!refs.includes(m[1])) refs.push(m[1]);
  }
  return refs;
}

/** Première référence libre (p1…p6), ou null si la maquette est pleine. */
export function nextImageRef(images: { ref: string }[]): string | null {
  const used = new Set(images.map((i) => i.ref));
  for (let i = 1; i <= MAX_DESIGN_IMAGES; i++) {
    const ref = `p${i}`;
    if (!used.has(ref)) return ref;
  }
  return null;
}

/** Lecture tolérante de la colonne jsonb (une maquette d'avant ce chantier peut n'avoir rien). */
export function parseStoredDesignImages(raw: unknown): DesignImage[] {
  const parsed = designImagesSchema.safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
}

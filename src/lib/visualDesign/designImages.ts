import { z } from "zod";

/**
 * Photos of a mockup (docs/SPEC_COMPOSITION_VISUELLE.md §1, §4): a mockup references 0 to 6
 * photos from the library, each displayed as is or cut out. The HTML designates them with
 * `{{IMG:p1}}`…; the client and the same-origin route resolve the reference into bytes. Pure module,
 * shared by the whitelist, the prompts, the service and the editor.
 */

export const MAX_DESIGN_IMAGES = 6;

export const DESIGN_IMAGE_VARIANTS = ["original", "cutout"] as const;
export type DesignImageVariant = (typeof DESIGN_IMAGE_VARIANTS)[number];

const REF_RE = /^p[1-6]$/;

export const designImageSchema = z.object({
  ref: z.string().regex(REF_RE, "invalid photo reference (p1 to p6)"),
  assetId: z.uuid(),
  variant: z.enum(DESIGN_IMAGE_VARIANTS),
});
export type DesignImage = z.infer<typeof designImageSchema>;

export const designImagesSchema = z
  .array(designImageSchema)
  .max(MAX_DESIGN_IMAGES, `${MAX_DESIGN_IMAGES} photos maximum par maquette`)
  .refine((list) => new Set(list.map((i) => i.ref)).size === list.length, { message: "duplicate photo references" })
  .refine((list) => new Set(list.map((i) => i.assetId)).size === list.length, { message: "the same photo cannot be declared twice" });

export function imagePlaceholder(ref: string): string {
  return `{{IMG:${ref}}}`;
}

const PLACEHOLDER_RE = /\{\{IMG:(p[1-6])\}\}/g;

/** `{{IMG:p2}}` → `p2`, sinon null. */
export function parseImagePlaceholder(src: string): string | null {
  const m = /^\{\{IMG:(p[1-6])\}\}$/.exec(src.trim());
  return m ? m[1] : null;
}

/** Photo references used in an HTML (deduplicated, in order of appearance). */
export function collectImageRefs(html: string): string[] {
  const refs: string[] = [];
  for (const m of html.matchAll(PLACEHOLDER_RE)) {
    if (!refs.includes(m[1])) refs.push(m[1]);
  }
  return refs;
}

/** First free reference (p1…p6), or null if the mockup is full. */
export function nextImageRef(images: { ref: string }[]): string | null {
  const used = new Set(images.map((i) => i.ref));
  for (let i = 1; i <= MAX_DESIGN_IMAGES; i++) {
    const ref = `p${i}`;
    if (!used.has(ref)) return ref;
  }
  return null;
}

/** Tolerant read of the jsonb column (a mockup predating this feature may have nothing). */
export function parseStoredDesignImages(raw: unknown): DesignImage[] {
  const parsed = designImagesSchema.safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
}

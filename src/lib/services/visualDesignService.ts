import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { brandAssets, creatorProfiles, scriptMicroEditEvents, scripts, users, visualDesigns } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { getObjectStorage } from "@/lib/storage";
import { logger } from "@/lib/logger";
import {
  composeDesign,
  designThemeSchema,
  reviseDesign,
  type DesignImageContext,
  type DesignPromptContext,
  type DesignTheme,
} from "@/lib/llm/designPrompts";
import { brandKitSchema, describeBrandKit, parseStoredBrandKit, type BrandKit } from "@/lib/visualDesign/brandKit";
import { DESIGN_FORMATS, defaultFormatForPlatform, type DesignFormatId } from "@/lib/visualDesign/formats";
import { DesignValidationError, sanitizeSlideHtml } from "@/lib/visualDesign/htmlSanitizer";
import {
  designImagesSchema,
  MAX_DESIGN_IMAGES,
  nextImageRef,
  parseStoredDesignImages,
  type DesignImage,
  type DesignImageVariant,
} from "@/lib/visualDesign/designImages";
import { ensureCutout, extFromMime, fetchAssetBytes, fetchCutoutBytes, type BrandAssetRow } from "@/lib/services/brandAssetService";
import { isBackgroundRemovalAvailable } from "@/lib/imaging/backgroundRemoval";
import { durationMsSchema, normalizeTimeline, TimelineValidationError, type Timeline } from "@/lib/visualDesign/timeline";
import { visualSpecFromScript } from "@/lib/visualDesign/visualFormat";
import { parseStoredStyleProfile } from "@/lib/llm/styleProfile";
import type { VerticalId } from "@/lib/verticals/types";

/**
 * Maquette d'un post visuel (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §5.2, docs/SPEC_COMPOSITION_VISUELLE.md
 * §5). Le HTML est LA représentation stockée, quelle que soit l'origine de l'écriture (agent ou
 * main) ; chaque écriture repasse par la liste blanche. Une seule version courante par script. Les
 * photos de la maquette (`images`) sont de vraies photos de la bibliothèque, entières ou détourées.
 */

export interface DesignSlide {
  planNumber: number;
  html: string;
  exportKey: string | null;
}

type DesignRow = typeof visualDesigns.$inferSelect;

export const MAX_DESIGN_SLIDES = 12;
export const MAX_EXPORT_BYTES = 4 * 1024 * 1024;
/** Export vidéo d'une animation (MP4) — docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §5.2. */
export const MAX_VIDEO_EXPORT_BYTES = 40 * 1024 * 1024;

export function slidesOf(row: DesignRow): DesignSlide[] {
  return (row.slides as DesignSlide[] | null) ?? [];
}

export function imagesOf(row: DesignRow): DesignImage[] {
  return parseStoredDesignImages(row.images);
}

/** Forme renvoyée au client : URLs d'export résolues, HTML tel quel, photos avec vignette. */
export function toApiDesign(row: DesignRow, assets: BrandAssetRow[] = []) {
  const storage = getObjectStorage();
  const byId = new Map(assets.map((a) => [a.id, a]));
  return {
    ...row,
    theme: row.theme as DesignTheme,
    timeline: (row.timeline as Timeline | null) ?? null,
    images: imagesOf(row).map((img) => {
      const asset = byId.get(img.assetId);
      return {
        ...img,
        thumbnailUrl: asset?.thumbnailKey ? storage.getPublicUrl(asset.thumbnailKey) : null,
        hasCutout: Boolean(asset?.cutoutKey),
      };
    }),
    slides: slidesOf(row).map((s) => ({ ...s, exportUrl: s.exportKey ? storage.getPublicUrl(s.exportKey) : null })),
    cutoutAvailable: isBackgroundRemovalAvailable(),
  };
}

/** Variante de `toApiDesign` qui charge elle-même les assets des photos (routes de la maquette). */
export async function toApiDesignWithAssets(row: DesignRow) {
  const ids = imagesOf(row).map((i) => i.assetId);
  const assets = ids.length > 0 ? await db.query.brandAssets.findMany({ where: and(inArray(brandAssets.id, ids), eq(brandAssets.userId, row.userId)) }) : [];
  return toApiDesign(row, assets);
}

export async function getDesignForScript(userId: string, scriptId: string): Promise<DesignRow | null> {
  const row = await db.query.visualDesigns.findFirst({
    where: and(eq(visualDesigns.scriptId, scriptId), eq(visualDesigns.userId, userId)),
  });
  return row ?? null;
}

async function loadOwnedScript(userId: string, scriptId: string) {
  const script = await db.query.scripts.findFirst({ where: and(eq(scripts.id, scriptId), eq(scripts.userId, userId)) });
  if (!script) throw new ApiError(404, "Script introuvable.");
  if (script.contentType !== "visual") throw new ApiError(400, "Seul un post visuel a une maquette.");
  return script;
}

/** Assets des photos déclarées, possédés par l'utilisateur, dans l'ordre des refs. Une photo disparue est ignorée. */
async function loadDesignAssets(userId: string, images: DesignImage[]): Promise<Map<string, BrandAssetRow>> {
  const ids = images.map((i) => i.assetId);
  if (ids.length === 0) return new Map();
  const rows = await db.query.brandAssets.findMany({ where: and(inArray(brandAssets.id, ids), eq(brandAssets.userId, userId)) });
  return new Map(rows.map((r) => [r.id, r]));
}

async function buildImageContexts(images: DesignImage[], assets: Map<string, BrandAssetRow>): Promise<DesignImageContext[]> {
  const productIds = [...new Set([...assets.values()].map((a) => a.productId).filter((id): id is string => Boolean(id)))];
  const productNames = new Map<string, string>();
  if (productIds.length > 0) {
    const { products } = await import("@/db/schema");
    const rows = await db.query.products.findMany({ where: inArray(products.id, productIds), columns: { id: true, name: true } });
    rows.forEach((p) => productNames.set(p.id, p.name));
  }
  const cutoutAvailable = isBackgroundRemovalAvailable();
  return images
    .map((img): DesignImageContext => {
      const asset = assets.get(img.assetId);
      // Photo retirée de la bibliothèque : la référence reste déclarée (le HTML courant peut la
      // citer, la liste blanche ne doit pas le refuser), mais l'agent est prévenu.
      if (!asset) return { ref: img.ref, description: "(photo retirée de la bibliothèque — ne plus l'utiliser, retire ses calques)", orientation: null, productName: null, cutoutAvailable: false };
      return {
        ref: img.ref,
        description: asset.aiDescription ?? "Photo de marque (pas de description disponible).",
        orientation: asset.orientation ?? null,
        productName: asset.productId ? (productNames.get(asset.productId) ?? null) : null,
        cutoutAvailable: cutoutAvailable || Boolean(asset.cutoutKey),
      };
    });
}

async function loadPromptContext(
  userId: string,
  width: number,
  height: number,
  images: DesignImageContext[],
  animationDurationMs: number | null = null
): Promise<{ prompt: DesignPromptContext; brandKit: BrandKit | null; profile: typeof creatorProfiles.$inferSelect }> {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) throw new ApiError(400, "Profil créateur introuvable.");
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { vertical: true } });
  const brandKit = parseStoredBrandKit(profile.brandKit);
  const hasLogo = Boolean(brandKit?.logoAssetId);
  return {
    profile,
    brandKit,
    prompt: {
      width,
      height,
      hasLogo,
      brandKitDescription: describeBrandKit(brandKit),
      vertical: (user?.vertical ?? "creator") as VerticalId,
      images,
      animationDurationMs,
    },
  };
}

/**
 * Applique les variantes choisies (agent ou utilisateur) : un détourage demandé est calculé s'il
 * n'est pas en cache ; s'il échoue, la photo repasse en "original" avec un avertissement — jamais
 * d'échec de composition pour ça (docs/SPEC_COMPOSITION_VISUELLE.md §2).
 */
async function applyVariants(images: DesignImage[], assets: Map<string, BrandAssetRow>): Promise<DesignImage[]> {
  const out: DesignImage[] = [];
  for (const img of images) {
    if (img.variant !== "cutout") {
      out.push(img);
      continue;
    }
    const asset = assets.get(img.assetId);
    if (!asset) {
      out.push({ ...img, variant: "original" });
      continue;
    }
    try {
      const ready = await ensureCutout(asset);
      assets.set(ready.id, ready);
      out.push(img);
    } catch (err) {
      logger.warn("Détourage impossible, photo gardée entière", { assetId: asset.id, err: String(err) });
      out.push({ ...img, variant: "original" });
    }
  }
  return out;
}

/**
 * Photos suggérées pour une maquette (docs/SPEC_COMPOSITION_VISUELLE.md §2 « Qui choisit les
 * photos ») : celle trouvée par recherche sémantique à la génération, puis celles rattachées au
 * produit du script, prêtes, dans la limite de 6.
 */
export async function suggestDesignAssets(userId: string, script: { brandAssetId: string | null; productId: string | null }): Promise<BrandAssetRow[]> {
  const out: BrandAssetRow[] = [];
  if (script.brandAssetId) {
    const first = await db.query.brandAssets.findFirst({
      where: and(eq(brandAssets.id, script.brandAssetId), eq(brandAssets.userId, userId), eq(brandAssets.status, "ready"), eq(brandAssets.archived, false)),
    });
    if (first) out.push(first);
  }
  if (script.productId) {
    const linked = await db.query.brandAssets.findMany({
      where: and(eq(brandAssets.productId, script.productId), eq(brandAssets.userId, userId), eq(brandAssets.status, "ready"), eq(brandAssets.archived, false)),
      orderBy: (t, { desc }) => desc(t.createdAt),
      limit: MAX_DESIGN_IMAGES,
    });
    for (const asset of linked) {
      if (out.length >= MAX_DESIGN_IMAGES) break;
      if (!out.some((a) => a.id === asset.id)) out.push(asset);
    }
  }
  return out;
}

export interface CreateDesignParams {
  /** Photos de la bibliothèque, dans l'ordre (p1, p2…) ; vide = composition typographique. */
  assetIds: string[];
  format?: DesignFormatId;
}

export async function createDesignForScript(userId: string, scriptId: string, params: CreateDesignParams) {
  const script = await loadOwnedScript(userId, scriptId);
  // Animation (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §5.2) : une seule slide, vertical par défaut,
  // durée reprise du script.
  const visualSpec = visualSpecFromScript(script);
  const isAnimation = visualSpec?.format === "animation";
  const formatId = params.format ?? (isAnimation ? "story" : defaultFormatForPlatform(script.platform));
  const format = DESIGN_FORMATS[formatId];
  const animationDurationMs = isAnimation ? (visualSpec?.durationMs ?? null) : null;

  // Photos : possédées, prêtes, dédoublonnées, 6 au plus, références attribuées dans l'ordre reçu.
  const uniqueIds = [...new Set(params.assetIds)];
  if (uniqueIds.length > MAX_DESIGN_IMAGES) throw new ApiError(400, `${MAX_DESIGN_IMAGES} photos maximum par maquette.`);
  const readyAssets =
    uniqueIds.length > 0
      ? await db.query.brandAssets.findMany({
          where: and(inArray(brandAssets.id, uniqueIds), eq(brandAssets.userId, userId), eq(brandAssets.status, "ready")),
        })
      : [];
  if (readyAssets.length !== uniqueIds.length) throw new ApiError(404, "Une des photos est introuvable ou pas encore prête.");
  const assets = new Map(readyAssets.map((a) => [a.id, a]));
  let images: DesignImage[] = uniqueIds.map((assetId, i) => ({ ref: `p${i + 1}`, assetId, variant: "original" as const }));
  const imageContexts = await buildImageContexts(images, assets);
  const { prompt, profile } = await loadPromptContext(userId, format.width, format.height, imageContexts, animationDurationMs);

  const storyboard = ((script.storyboard as { planNumber: number; description: string }[] | null) ?? []).slice(0, MAX_DESIGN_SLIDES);
  if (storyboard.length === 0) throw new ApiError(400, "Le storyboard est vide : rien à mettre en page.");

  const result = await composeDesign({
    prompt,
    post: {
      platform: script.platform,
      title: script.title,
      hookVisual: script.hookVisual,
      storyboard,
      brandName: profile.brandName,
      // Ton appris des retouches (styleProfile) : plus de ton déclaré dans le profil.
      tone: parseStoredStyleProfile(profile.styleProfile)?.tone ?? null,
    },
  });

  // Variantes retenues par l'agent, détourages calculés si besoin ; les photos non utilisées restent
  // déclarées (l'utilisateur peut s'en servir à la main).
  const chosen = new Map(result.images.map((i) => [i.ref, i.variant]));
  images = await applyVariants(
    images.map((img) => ({ ...img, variant: chosen.get(img.ref) ?? "original" })),
    assets
  );

  const slides: DesignSlide[] = result.slides.map((s) => ({ ...s, exportKey: null }));
  const values = {
    durationMs: animationDurationMs,
    timeline: result.timeline,
    userId,
    scriptId,
    images,
    width: format.width,
    height: format.height,
    theme: result.theme,
    slides,
    status: "draft" as const,
    lastInstruction: null,
    updatedAt: new Date(),
  };
  // Remplace la version courante s'il y en a une (exports précédents supprimés, meilleur effort).
  const existing = await getDesignForScript(userId, scriptId);
  if (existing) await deleteExports(existing);
  // Upsert sur script_id (UNIQUE) : la composition automatique (after()) et un clic « Composer »
  // peuvent finir en même temps, le dernier arrivé remplace l'autre au lieu d'échouer en 500.
  const [row] = await db
    .insert(visualDesigns)
    .values(values)
    .onConflictDoUpdate({ target: visualDesigns.scriptId, set: values })
    .returning();
  return { design: row, rationale: result.rationale };
}

/**
 * Composition automatique juste après la génération d'un script visuel (docs/SPEC_COMPOSITION_VISUELLE.md
 * §2 « Quand la maquette est composée ») — appelée dans `after()` par les routes de génération.
 * Jamais bloquant : toute erreur est journalisée et laisse le script sans maquette (la fiche
 * retombe sur le bouton « Composer »).
 */
export async function autoComposeDesign(userId: string, scriptId: string): Promise<void> {
  try {
    const script = await db.query.scripts.findFirst({ where: and(eq(scripts.id, scriptId), eq(scripts.userId, userId)) });
    if (!script || script.contentType !== "visual") return;
    if (await getDesignForScript(userId, scriptId)) return;
    const suggested = await suggestDesignAssets(userId, script);
    await createDesignForScript(userId, scriptId, { assetIds: suggested.map((a) => a.id) });
  } catch (err) {
    logger.warn("Composition automatique de la maquette échouée", { scriptId, err: String(err) });
  }
}

export async function instructDesign(userId: string, scriptId: string, params: { instruction: string; planNumber?: number | null }) {
  const design = await getDesignForScript(userId, scriptId);
  if (!design) throw new ApiError(404, "Pas de maquette pour ce script.");
  const images = imagesOf(design);
  const assets = await loadDesignAssets(userId, images);
  const imageContexts = await buildImageContexts(images, assets);
  const { prompt } = await loadPromptContext(userId, design.width, design.height, imageContexts, design.durationMs);
  const current = slidesOf(design);
  const planNumber = params.planNumber ?? null;
  if (planNumber !== null && !current.some((s) => s.planNumber === planNumber)) {
    throw new ApiError(404, "Slide introuvable.");
  }
  const result = await reviseDesign({
    prompt,
    instruction: params.instruction,
    planNumber,
    theme: design.theme as DesignTheme,
    slides: current.map((s) => ({ planNumber: s.planNumber, html: s.html })),
    currentVariants: images.map((i) => ({ ref: i.ref, variant: i.variant })),
    timeline: (design.timeline as Timeline | null) ?? null,
  });
  // Les slides hors portée restent celles d'avant, quoi qu'ait renvoyé le modèle ; les exports des
  // slides modifiées sont invalidés.
  const byPlan = new Map(result.slides.map((s) => [s.planNumber, s.html]));
  const slides: DesignSlide[] = current.map((s) => {
    const inScope = planNumber === null || s.planNumber === planNumber;
    const next = inScope ? byPlan.get(s.planNumber) : undefined;
    if (next === undefined || next === s.html) return s;
    return { planNumber: s.planNumber, html: next, exportKey: null };
  });
  if (planNumber === null) {
    for (const added of result.slides) {
      if (!slides.some((s) => s.planNumber === added.planNumber) && slides.length < MAX_DESIGN_SLIDES) {
        slides.push({ planNumber: added.planNumber, html: added.html, exportKey: null });
      }
    }
    slides.sort((a, b) => a.planNumber - b.planNumber);
  }
  // Variantes : l'agent peut basculer une photo (ex. « détoure le produit ») ; celles qu'il ne cite
  // pas gardent leur variante.
  const chosen = new Map(result.images.map((i) => [i.ref, i.variant]));
  const nextImages = await applyVariants(
    images.map((img) => ({ ...img, variant: chosen.get(img.ref) ?? img.variant })),
    assets
  );
  const [row] = await db
    .update(visualDesigns)
    .set({
      theme: planNumber === null ? result.theme : design.theme,
      timeline: design.durationMs ? (result.timeline ?? design.timeline) : null,
      slides,
      images: nextImages,
      lastInstruction: params.instruction,
      status: design.status === "stale" ? "stale" : "draft",
      updatedAt: new Date(),
    })
    .where(eq(visualDesigns.id, design.id))
    .returning();
  await db.insert(scriptMicroEditEvents).values({ userId, scriptId, kind: "design_instruction" });
  return { design: row, rationale: result.rationale };
}

export interface PatchDesignParams {
  slides?: { planNumber: number; html: string }[];
  theme?: unknown;
  /** Photos déclarées et leurs variantes (bascule original / détouré, retrait d'une photo). */
  images?: unknown;
  /** Animation : ligne de temps et durée retouchées à la main (§6). */
  timeline?: unknown;
  durationMs?: number;
}

/** Retouche manuelle : le client envoie le HTML des slides touchées, le serveur le repasse par la liste blanche. */
export async function patchDesign(userId: string, scriptId: string, params: PatchDesignParams) {
  const design = await getDesignForScript(userId, scriptId);
  if (!design) throw new ApiError(404, "Pas de maquette pour ce script.");
  const { brandKit } = await loadPromptContext(userId, design.width, design.height, []);
  const hasLogo = Boolean(brandKit?.logoAssetId);

  // Photos : la liste complète est renvoyée ; chaque photo doit appartenir à l'utilisateur.
  let images = imagesOf(design);
  if (params.images !== undefined) {
    const parsed = designImagesSchema.safeParse(params.images);
    if (!parsed.success) throw new ApiError(422, `Photos refusées : ${parsed.error.issues.map((i) => i.message).join(" · ")}`);
    const assets = await loadDesignAssets(userId, parsed.data);
    if (parsed.data.some((i) => !assets.has(i.assetId))) throw new ApiError(404, "Une des photos est introuvable.");
    images = await applyVariants(parsed.data, assets);
  }
  const imageRefs = images.map((i) => i.ref);

  const current = slidesOf(design);
  let slides = current;
  if (params.slides) {
    if (params.slides.length > MAX_DESIGN_SLIDES) throw new ApiError(400, `${MAX_DESIGN_SLIDES} slides maximum.`);
    const issues: string[] = [];
    const incoming = new Map<number, string>();
    for (const slide of params.slides) {
      try {
        incoming.set(slide.planNumber, sanitizeSlideHtml(slide.html, { width: design.width, height: design.height, hasLogo, imageRefs }).html);
      } catch (err) {
        if (err instanceof DesignValidationError) issues.push(...err.issues.map((i) => `slide ${slide.planNumber} : ${i}`));
        else throw err;
      }
    }
    if (issues.length > 0) throw new ApiError(422, `Maquette refusée : ${issues.join(" · ")}`);
    // Le client envoie la liste complète des slides (ajouts et suppressions compris).
    slides = [...incoming.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([planNumber, html]) => {
        const previous = current.find((s) => s.planNumber === planNumber);
        return { planNumber, html, exportKey: previous && previous.html === html ? previous.exportKey : null };
      });
    if (slides.length === 0) throw new ApiError(400, "Une maquette garde au moins une slide.");
  } else if (params.images !== undefined) {
    // Une photo retirée de la liste ne doit plus être citée par le HTML courant.
    for (const slide of current) {
      try {
        sanitizeSlideHtml(slide.html, { width: design.width, height: design.height, hasLogo, imageRefs });
      } catch (err) {
        if (err instanceof DesignValidationError) throw new ApiError(422, `Photos refusées : slide ${slide.planNumber} : ${err.issues.join(" · ")}`);
        throw err;
      }
    }
  }
  const theme = params.theme !== undefined ? designThemeSchema.parse(params.theme) : (design.theme as DesignTheme);
  // Ligne de temps (animation) : revalidée contre les calques de la slide finale et la durée.
  let durationMs = design.durationMs;
  let timeline = (design.timeline as Timeline | null) ?? null;
  if (design.durationMs) {
    if (params.durationMs !== undefined) durationMs = durationMsSchema.parse(params.durationMs);
    const raw = params.timeline !== undefined ? params.timeline : timeline;
    const layerIds = sanitizeSlideHtml(slides[0].html, { width: design.width, height: design.height, hasLogo, imageRefs }).layerIds;
    try {
      timeline = normalizeTimeline(raw ?? [], layerIds, durationMs!);
    } catch (err) {
      if (err instanceof TimelineValidationError) throw new ApiError(422, `Ligne de temps refusée : ${err.issues.join(" · ")}`);
      throw err;
    }
  }
  // N'écrit que les colonnes réellement envoyées : `applyVariants` peut avoir attendu un détourage
  // (jusqu'à 30 s), pendant lequel une autre sauvegarde (slides) a pu passer — on ne la repousse pas.
  const [row] = await db
    .update(visualDesigns)
    .set({
      ...(params.slides !== undefined && { slides }),
      ...(params.theme !== undefined && { theme }),
      ...(params.images !== undefined && { images }),
      ...(design.durationMs && (params.slides !== undefined || params.timeline !== undefined || params.durationMs !== undefined) && { timeline, durationMs }),
      status: design.status === "stale" ? "stale" : "draft",
      updatedAt: new Date(),
    })
    .where(eq(visualDesigns.id, design.id))
    .returning();
  return row;
}

/** Ajoute une photo à la maquette sans recomposer (§6 « Ajouter une photo ») ; renvoie sa référence. */
export async function addDesignImage(userId: string, scriptId: string, assetId: string) {
  const design = await getDesignForScript(userId, scriptId);
  if (!design) throw new ApiError(404, "Pas de maquette pour ce script.");
  const images = imagesOf(design);
  if (images.some((i) => i.assetId === assetId)) throw new ApiError(409, "Cette photo est déjà dans la maquette.");
  const ref = nextImageRef(images);
  if (!ref) throw new ApiError(400, `${MAX_DESIGN_IMAGES} photos maximum par maquette.`);
  const asset = await db.query.brandAssets.findFirst({
    where: and(eq(brandAssets.id, assetId), eq(brandAssets.userId, userId), eq(brandAssets.status, "ready")),
  });
  if (!asset) throw new ApiError(404, "Photo introuvable ou pas encore prête.");
  const next: DesignImage[] = [...images, { ref, assetId, variant: "original" }];
  const [row] = await db
    .update(visualDesigns)
    .set({ images: next, updatedAt: new Date() })
    .where(eq(visualDesigns.id, design.id))
    .returning();
  return { design: row, ref };
}

export async function deleteDesign(userId: string, scriptId: string) {
  const design = await getDesignForScript(userId, scriptId);
  if (!design) throw new ApiError(404, "Pas de maquette pour ce script.");
  await deleteExports(design);
  await db.delete(visualDesigns).where(eq(visualDesigns.id, design.id));
}

async function deleteExports(design: DesignRow) {
  const storage = getObjectStorage();
  for (const slide of slidesOf(design)) {
    if (!slide.exportKey) continue;
    await storage.delete(slide.exportKey).catch((err) => logger.warn("Export de maquette non supprimé", { key: slide.exportKey, err: String(err) }));
  }
}

/** Appelé par patchScriptContent quand les mots du storyboard changent (§2 « Source des mots »). Jamais bloquant. */
export async function markDesignStale(scriptId: string): Promise<void> {
  await db
    .update(visualDesigns)
    .set({ status: "stale", updatedAt: new Date() })
    .where(and(eq(visualDesigns.scriptId, scriptId), eq(visualDesigns.status, "draft")))
    .catch((err) => logger.warn("Marquage stale de la maquette échoué", { scriptId, err: String(err) }));
  await db
    .update(visualDesigns)
    .set({ status: "stale", updatedAt: new Date() })
    .where(and(eq(visualDesigns.scriptId, scriptId), eq(visualDesigns.status, "exported")))
    .catch(() => {});
}

export interface ExportFile {
  planNumber: number;
  bytes: Buffer;
  mimeType: string;
}

/** Réception des PNG rendus par le navigateur (§2 « Export »). */
export async function storeDesignExports(userId: string, scriptId: string, files: ExportFile[]) {
  const design = await getDesignForScript(userId, scriptId);
  if (!design) throw new ApiError(404, "Pas de maquette pour ce script.");
  const storage = getObjectStorage();
  const slides = slidesOf(design);
  for (const file of files) {
    const slide = slides.find((s) => s.planNumber === file.planNumber);
    if (!slide) throw new ApiError(400, `Slide ${file.planNumber} inconnue.`);
    const limit = file.mimeType.startsWith("video/") ? MAX_VIDEO_EXPORT_BYTES : MAX_EXPORT_BYTES;
    if (file.bytes.length > limit) throw new ApiError(413, `Slide ${file.planNumber} : fichier trop lourd.`);
    if (slide.exportKey) await storage.delete(slide.exportKey).catch(() => {});
    const key = `designs/${userId}/${design.id}/${file.planNumber}-${crypto.randomUUID().slice(0, 8)}.${extFromMime(file.mimeType)}`;
    await storage.upload(key, file.bytes, file.mimeType);
    slide.exportKey = key;
  }
  const allExported = slides.every((s) => s.exportKey);
  const [row] = await db
    .update(visualDesigns)
    .set({ slides, status: allExported && design.status !== "stale" ? "exported" : design.status, updatedAt: new Date() })
    .where(eq(visualDesigns.id, design.id))
    .returning();
  return row;
}

/**
 * Octets d'une photo de la maquette (`{{IMG:ref}}`), servis same-origin au canevas et à l'export :
 * l'original (bibliothèque ou Drive) ou le détouré (R2) selon la variante déclarée.
 */
export async function getDesignImage(userId: string, scriptId: string, ref: string, variant?: DesignImageVariant): Promise<{ bytes: Buffer; mimeType: string }> {
  const design = await getDesignForScript(userId, scriptId);
  if (!design) throw new ApiError(404, "Pas de maquette pour ce script.");
  const image = imagesOf(design).find((i) => i.ref === ref);
  if (!image) throw new ApiError(404, "Photo inconnue sur cette maquette.");
  const asset = await db.query.brandAssets.findFirst({ where: and(eq(brandAssets.id, image.assetId), eq(brandAssets.userId, userId)) });
  if (!asset) throw new ApiError(404, "Photo introuvable.");
  // Le détourage n'est jamais déclenché par cette lecture (route GET sans limite de débit) : il
  // est calculé par PATCH / POST cutout. Sans détouré en cache, on sert l'original.
  if ((variant ?? image.variant) === "cutout" && asset.cutoutKey) return fetchCutoutBytes(asset);
  return fetchAssetBytes(asset);
}

export async function getBrandLogo(userId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  const kit = parseStoredBrandKit(profile?.brandKit);
  if (!kit?.logoAssetId) throw new ApiError(404, "Aucun logo défini.");
  const asset = await db.query.brandAssets.findFirst({ where: and(eq(brandAssets.id, kit.logoAssetId), eq(brandAssets.userId, userId)) });
  if (!asset) throw new ApiError(404, "Logo introuvable.");
  return fetchAssetBytes(asset);
}

export async function saveBrandKit(userId: string, raw: unknown): Promise<BrandKit> {
  const kit = brandKitSchema.parse(raw);
  if (kit.logoAssetId) {
    const asset = await db.query.brandAssets.findFirst({ where: and(eq(brandAssets.id, kit.logoAssetId), eq(brandAssets.userId, userId)) });
    if (!asset) throw new ApiError(404, "Logo introuvable dans la bibliothèque.");
  }
  const [profile] = await db.update(creatorProfiles).set({ brandKit: kit }).where(eq(creatorProfiles.userId, userId)).returning({ id: creatorProfiles.id });
  if (!profile) throw new ApiError(400, "Profil créateur introuvable.");
  return kit;
}

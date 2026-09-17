import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { brandAssets, creatorProfiles, generatedImages, scriptMicroEditEvents, scripts, users, visualDesigns } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { getObjectStorage } from "@/lib/storage";
import { logger } from "@/lib/logger";
import { composeDesign, designThemeSchema, reviseDesign, type DesignPromptContext, type DesignTheme } from "@/lib/llm/designPrompts";
import { brandKitSchema, describeBrandKit, parseStoredBrandKit, type BrandKit } from "@/lib/visualDesign/brandKit";
import { DESIGN_FORMATS, defaultFormatForPlatform, type DesignFormatId } from "@/lib/visualDesign/formats";
import { DesignValidationError, sanitizeSlideHtml } from "@/lib/visualDesign/htmlSanitizer";
import { fetchAssetBytes, extFromMime } from "@/lib/services/brandAssetService";
import { durationMsSchema, normalizeTimeline, TimelineValidationError, type Timeline } from "@/lib/visualDesign/timeline";
import { visualSpecFromScript } from "@/lib/visualDesign/visualFormat";
import type { VerticalId } from "@/lib/verticals/types";

/**
 * Maquette d'un post visuel (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §5.2). Le HTML est LA
 * représentation stockée, quelle que soit l'origine de l'écriture (agent ou main) ; chaque écriture
 * repasse par la liste blanche. Une seule version courante par script.
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

/** Forme renvoyée au client : URLs d'export résolues, HTML tel quel. */
export function toApiDesign(row: DesignRow) {
  const storage = getObjectStorage();
  return {
    ...row,
    theme: row.theme as DesignTheme,
    timeline: (row.timeline as Timeline | null) ?? null,
    slides: slidesOf(row).map((s) => ({ ...s, exportUrl: s.exportKey ? storage.getPublicUrl(s.exportKey) : null })),
  };
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

async function loadPromptContext(
  userId: string,
  width: number,
  height: number,
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
      animationDurationMs,
    },
  };
}

export interface CreateDesignParams {
  baseKind: "generated" | "asset" | "none";
  baseAssetId?: string | null;
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
  const { prompt, profile } = await loadPromptContext(userId, format.width, format.height, animationDurationMs);

  // Base de la slide : photo générée (pipeline existant), photo de la bibliothèque, ou rien.
  let baseGeneratedImageId: string | null = null;
  let baseAssetId: string | null = null;
  let baseDescription: string | null = null;
  let baseOrientation: string | null = null;
  if (params.baseKind === "generated") {
    if (!script.generatedImageId) throw new ApiError(400, "Ce script n'a pas encore de photo mise en scène.");
    baseGeneratedImageId = script.generatedImageId;
    // Le pipeline de mise en scène ne décrit pas l'image produite : on s'appuie sur la photo de
    // référence dont elle est issue, plus l'instruction de mise en scène.
    const generated = await db.query.generatedImages.findFirst({ where: eq(generatedImages.id, script.generatedImageId) });
    const sourceId = generated?.sourceAssetIds[0];
    const source = sourceId ? await db.query.brandAssets.findFirst({ where: eq(brandAssets.id, sourceId) }) : null;
    baseDescription = [source?.aiDescription, generated?.instruction ? `Mise en scène : ${generated.instruction}` : null]
      .filter(Boolean)
      .join(" · ");
    baseOrientation = source?.orientation ?? null;
    if (!baseDescription) baseDescription = "Photo de marque mise en scène (pas de description disponible).";
  } else if (params.baseKind === "asset") {
    if (!params.baseAssetId) throw new ApiError(400, "Choisis une photo de la bibliothèque.");
    const asset = await db.query.brandAssets.findFirst({
      where: and(eq(brandAssets.id, params.baseAssetId), eq(brandAssets.userId, userId), eq(brandAssets.status, "ready")),
    });
    if (!asset) throw new ApiError(404, "Photo introuvable ou pas encore prête.");
    baseAssetId = asset.id;
    baseDescription = asset.aiDescription ?? "Photo de marque (pas de description disponible).";
    baseOrientation = asset.orientation ?? null;
  }

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
      tone: profile.tone,
      baseDescription: params.baseKind === "none" ? null : baseDescription,
      baseOrientation,
    },
  });

  const slides: DesignSlide[] = result.slides.map((s) => ({ ...s, exportKey: null }));
  const values = {
    durationMs: animationDurationMs,
    timeline: result.timeline,
    userId,
    scriptId,
    baseKind: params.baseKind,
    baseGeneratedImageId,
    baseAssetId,
    width: format.width,
    height: format.height,
    theme: result.theme,
    slides,
    status: "draft" as const,
    lastInstruction: null,
    containsAiImagery: params.baseKind === "generated",
    updatedAt: new Date(),
  };
  // Remplace la version courante s'il y en a une (exports précédents supprimés, meilleur effort).
  const existing = await getDesignForScript(userId, scriptId);
  if (existing) await deleteExports(existing);
  const [row] = existing
    ? await db.update(visualDesigns).set(values).where(eq(visualDesigns.id, existing.id)).returning()
    : await db.insert(visualDesigns).values(values).returning();
  return { design: row, rationale: result.rationale };
}

export async function instructDesign(userId: string, scriptId: string, params: { instruction: string; planNumber?: number | null }) {
  const design = await getDesignForScript(userId, scriptId);
  if (!design) throw new ApiError(404, "Pas de maquette pour ce script.");
  const { prompt } = await loadPromptContext(userId, design.width, design.height, design.durationMs);
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
  const [row] = await db
    .update(visualDesigns)
    .set({
      theme: planNumber === null ? result.theme : design.theme,
      timeline: design.durationMs ? (result.timeline ?? design.timeline) : null,
      slides,
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
  /** Animation : ligne de temps et durée retouchées à la main (§6). */
  timeline?: unknown;
  durationMs?: number;
}

/** Retouche manuelle : le client envoie le HTML des slides touchées, le serveur le repasse par la liste blanche. */
export async function patchDesign(userId: string, scriptId: string, params: PatchDesignParams) {
  const design = await getDesignForScript(userId, scriptId);
  if (!design) throw new ApiError(404, "Pas de maquette pour ce script.");
  const { brandKit } = await loadPromptContext(userId, design.width, design.height);
  const hasLogo = Boolean(brandKit?.logoAssetId);
  const current = slidesOf(design);
  let slides = current;
  if (params.slides) {
    if (params.slides.length > MAX_DESIGN_SLIDES) throw new ApiError(400, `${MAX_DESIGN_SLIDES} slides maximum.`);
    const issues: string[] = [];
    const incoming = new Map<number, string>();
    for (const slide of params.slides) {
      try {
        incoming.set(slide.planNumber, sanitizeSlideHtml(slide.html, { width: design.width, height: design.height, hasLogo }).html);
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
  }
  const theme = params.theme !== undefined ? designThemeSchema.parse(params.theme) : (design.theme as DesignTheme);
  // Ligne de temps (animation) : revalidée contre les calques de la slide finale et la durée.
  let durationMs = design.durationMs;
  let timeline = (design.timeline as Timeline | null) ?? null;
  if (design.durationMs) {
    if (params.durationMs !== undefined) durationMs = durationMsSchema.parse(params.durationMs);
    const raw = params.timeline !== undefined ? params.timeline : timeline;
    const layerIds = sanitizeSlideHtml(slides[0].html, { width: design.width, height: design.height, hasLogo }).layerIds;
    try {
      timeline = normalizeTimeline(raw ?? [], layerIds, durationMs!);
    } catch (err) {
      if (err instanceof TimelineValidationError) throw new ApiError(422, `Ligne de temps refusée : ${err.issues.join(" · ")}`);
      throw err;
    }
  }
  const [row] = await db
    .update(visualDesigns)
    .set({ slides, theme, timeline, durationMs, status: design.status === "stale" ? "stale" : "draft", updatedAt: new Date() })
    .where(eq(visualDesigns.id, design.id))
    .returning();
  return row;
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

/** Octets de l'image de base, servis same-origin au canevas et à l'export. */
export async function getDesignBaseImage(userId: string, scriptId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const design = await getDesignForScript(userId, scriptId);
  if (!design) throw new ApiError(404, "Pas de maquette pour ce script.");
  if (design.baseKind === "generated" && design.baseGeneratedImageId) {
    const generated = await db.query.generatedImages.findFirst({
      where: and(eq(generatedImages.id, design.baseGeneratedImageId), eq(generatedImages.userId, userId)),
    });
    if (!generated) throw new ApiError(404, "Image de base introuvable.");
    return { bytes: await getObjectStorage().download(generated.storageKey), mimeType: generated.mimeType };
  }
  if (design.baseKind === "asset" && design.baseAssetId) {
    const asset = await db.query.brandAssets.findFirst({ where: and(eq(brandAssets.id, design.baseAssetId), eq(brandAssets.userId, userId)) });
    if (!asset) throw new ApiError(404, "Image de base introuvable.");
    return fetchAssetBytes(asset);
  }
  throw new ApiError(404, "Cette maquette n'a pas d'image de base.");
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

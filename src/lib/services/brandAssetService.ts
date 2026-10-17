import crypto from "node:crypto";
import sharp from "sharp";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { brandAssets, products } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { getObjectStorage } from "@/lib/storage";
import { fetchFileMedia, fetchFileMetadata } from "@/lib/googleDrive/client";
import { getValidAccessToken } from "@/lib/services/googleDriveService";
import { captionImage } from "@/lib/llm/providers/geminiImage";
import { buildCaptionSystemPrompt } from "@/lib/llm/captionPrompts";
import { brandAssetCaptionSchema, captionBrandAssetTool } from "@/lib/llm/visionSchema";
import { embedText } from "@/lib/llm/embeddings";
import { buildAssetSearchQuery, type AssetSearchContext } from "@/lib/services/assetSelection";
import { logger } from "@/lib/logger";
import { getBackgroundRemover } from "@/lib/imaging/backgroundRemoval";

const THUMBNAIL_WIDTH = 400;

export interface UploadedFileInput {
  buffer: Buffer;
  mimeType: string;
  size: number;
}

export function extFromMime(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "image/jpeg":
    default:
      return "jpg";
  }
}

function computeChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function buildThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
}

/**
 * Ingestion by direct upload. Unlike the Google Drive source (whose original stays in
 * the user's Drive, see docs/SPEC_RESSOURCES_VISUELLES.md §4.1), no other copy of the image
 * exists here: the original is therefore stored on R2 in addition to the thumbnail.
 */
export async function createUploadedAssets(userId: string, files: UploadedFileInput[]) {
  if (files.length === 0) {
    throw new ApiError(400, "No file provided.");
  }

  const storage = getObjectStorage();
  const created = [];

  for (const file of files) {
    if (!file.mimeType.startsWith("image/")) {
      throw new ApiError(400, `Unsupported file type: "${file.mimeType}".`);
    }

    const metadata = await sharp(file.buffer).metadata();
    const thumbnail = await buildThumbnail(file.buffer);
    const ext = extFromMime(file.mimeType);

    const [asset] = await db
      .insert(brandAssets)
      .values({
        userId,
        sourceType: "upload",
        checksum: computeChecksum(file.buffer),
        mimeType: file.mimeType,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        status: "pending",
      })
      .returning();

    const originalKey = `assets/${userId}/${asset.id}-original.${ext}`;
    const thumbnailKey = `assets/${userId}/${asset.id}-thumb.jpg`;

    await storage.upload(originalKey, file.buffer, file.mimeType);
    await storage.upload(thumbnailKey, thumbnail, "image/jpeg");

    const [updated] = await db
      .update(brandAssets)
      .set({ originalKey, thumbnailKey })
      .where(eq(brandAssets.id, asset.id))
      .returning();

    created.push(updated);
  }

  return created;
}

/**
 * Ingestion from a Google Picker selection. Unlike direct upload, the original is
 * not stored on R2 — it stays in the user's Drive (docs/SPEC_RESSOURCES_VISUELLES.md
 * §4.1) and will be re-read on demand via `files.get` (captioning, image generation).
 */
export async function createDriveAssets(userId: string, fileIds: string[]) {
  if (fileIds.length === 0) {
    throw new ApiError(400, "No file selected.");
  }

  const accessToken = await getValidAccessToken(userId);
  const storage = getObjectStorage();
  const created = [];

  for (const fileId of fileIds) {
    const metadata = await fetchFileMetadata(fileId, accessToken);
    if (!metadata.mimeType.startsWith("image/")) {
      continue; // silently ignore non-images in a Picker selection (DOCS_IMAGES view)
    }

    const { bytes } = await fetchFileMedia(fileId, accessToken);
    const imgMetadata = await sharp(bytes).metadata();
    const thumbnail = await buildThumbnail(bytes);

    const [asset] = await db
      .insert(brandAssets)
      .values({
        userId,
        sourceType: "google_drive",
        externalId: fileId,
        sourceCheckedAt: new Date(),
        checksum: metadata.md5Checksum,
        mimeType: metadata.mimeType,
        width: imgMetadata.width ?? null,
        height: imgMetadata.height ?? null,
        status: "pending",
      })
      .returning();

    const thumbnailKey = `assets/${userId}/${asset.id}-thumb.jpg`;
    await storage.upload(thumbnailKey, thumbnail, "image/jpeg");

    const [updated] = await db
      .update(brandAssets)
      .set({ thumbnailKey })
      .where(eq(brandAssets.id, asset.id))
      .returning();

    created.push(updated);
  }

  if (created.length === 0) {
    throw new ApiError(400, "No usable image in the selection.");
  }

  return created;
}

export async function listAssetsForUser(userId: string) {
  return db.query.brandAssets.findMany({
    where: and(eq(brandAssets.userId, userId), eq(brandAssets.archived, false)),
    orderBy: (assets, { desc }) => [desc(assets.createdAt)],
  });
}

export type BrandAssetRow = typeof brandAssets.$inferSelect;

/** Retrieves an asset's bytes — R2 for a direct upload, Drive on demand otherwise. */
export async function fetchAssetBytes(asset: BrandAssetRow): Promise<{ bytes: Buffer; mimeType: string }> {
  if (asset.sourceType === "upload") {
    if (!asset.originalKey) {
      throw new Error(`Asset ${asset.id}: originalKey missing for an "upload" source.`);
    }
    return { bytes: await getObjectStorage().download(asset.originalKey), mimeType: asset.mimeType };
  }

  if (!asset.externalId) {
    throw new Error(`Asset ${asset.id}: externalId missing for a "google_drive" source.`);
  }
  const accessToken = await getValidAccessToken(asset.userId);
  return fetchFileMedia(asset.externalId, accessToken);
}

// Unicode property escape (ES2018+) rather than a hard-coded range of combining characters —
// more readable and with no encoding ambiguity.
function normalizeProductName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * Captioning + embedding of an asset — called from `after()` right after ingestion (upload or
 * Picker), never replayed automatically (docs/SPEC_RESSOURCES_VISUELLES.md §5.1). Any error
 * leaves the asset as "pending", except confirmed loss of Drive access ("unreachable").
 */
export async function processAssetCaptioning(assetId: string): Promise<void> {
  const asset = await db.query.brandAssets.findFirst({ where: eq(brandAssets.id, assetId) });
  if (!asset) return; // asset deleted in the meantime

  const userProducts = await db.query.products.findMany({ where: eq(products.userId, asset.userId) });

  let bytes: Buffer;
  let mimeType: string;
  try {
    ({ bytes, mimeType } = await fetchAssetBytes(asset));
  } catch (err) {
    logger.error("Failed to read an asset's bytes", err, { assetId });
    await db.update(brandAssets).set({ status: "unreachable" }).where(eq(brandAssets.id, assetId));
    return;
  }

  const rawCaption = await captionImage(
    bytes,
    mimeType,
    buildCaptionSystemPrompt(userProducts.map((p) => p.name)),
    captionBrandAssetTool
  );
  const caption = brandAssetCaptionSchema.parse(rawCaption);

  const matchedProduct = caption.matchedProductName
    ? userProducts.find((p) => normalizeProductName(p.name) === normalizeProductName(caption.matchedProductName!))
    : undefined;

  const embedding = await embedText(caption.description);

  await db
    .update(brandAssets)
    .set({
      aiDescription: caption.description,
      tags: [caption.mainSubject, caption.mood, caption.dominantColor],
      orientation: caption.orientation,
      hasEmbeddedText: caption.hasEmbeddedText,
      productId: matchedProduct?.id ?? null,
      embedding,
      status: "ready",
    })
    .where(eq(brandAssets.id, assetId));
}

export interface SelectedBrandAsset {
  id: string;
  aiDescription: string;
  tags: string[] | null;
}

/**
 * Semantic search for the best BrandAsset for a "visual" script — `productId` filtering
 * upstream of the vector query (docs/SPEC_RESSOURCES_VISUELLES.md §5.3), falling back to no topic
 * filter if nothing matches. Graceful degradation (`null`) if the library is empty or still
 * being processed — same pattern as `pickAngleForScript` (src/lib/services/angleService.ts).
 */
export async function findBestBrandAssetForScript(
  userId: string,
  params: Omit<AssetSearchContext, "productName"> & { productId?: string | null }
): Promise<SelectedBrandAsset | null> {
  // No usable image: we exit before the embedding. It used to be the reverse order, and since nothing
  // caught the error, a "visual" generation failed with a 500 even for a user who
  // had never uploaded a single image (docs/SPEC_RESSOURCES_VISUELLES.md §8.4).
  const [anyReadyAsset] = await db
    .select({ id: brandAssets.id })
    .from(brandAssets)
    .where(and(eq(brandAssets.userId, userId), eq(brandAssets.status, "ready"), eq(brandAssets.archived, false)))
    .limit(1);
  if (!anyReadyAsset) return null;

  const productName = params.productId
    ? (await db.query.products.findFirst({ where: eq(products.id, params.productId) }))?.name ?? null
    : null;

  const queryText = buildAssetSearchQuery({
    categoryLabel: params.categoryLabel,
    categoryDescription: params.categoryDescription,
    productName,
    seriesLabel: params.seriesLabel,
  });

  // A reference image is a bonus, never a condition for writing a script: an unavailable
  // embedding degrades the generation (no image suggested), it does not interrupt it.
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(queryText);
  } catch (err) {
    logger.warn("Image search embedding unavailable, generating without a reference image", {
      userId,
      err: String(err),
    });
    return null;
  }
  const vectorParam = `[${queryEmbedding.join(",")}]`;

  const search = (filterByProduct: boolean) => {
    const conditions = [eq(brandAssets.userId, userId), eq(brandAssets.status, "ready"), eq(brandAssets.archived, false)];
    if (filterByProduct && params.productId) {
      conditions.push(eq(brandAssets.productId, params.productId));
    }
    return db
      .select({ id: brandAssets.id, aiDescription: brandAssets.aiDescription, tags: brandAssets.tags })
      .from(brandAssets)
      .where(and(...conditions))
      .orderBy(sql`${brandAssets.embedding} <=> ${vectorParam}::vector`)
      .limit(1);
  };

  const primary = params.productId ? await search(true) : [];
  const [best] = primary.length > 0 ? primary : await search(false);
  return best ? { id: best.id, aiDescription: best.aiDescription!, tags: best.tags } : null;
}

/**
 * Recomputes the embedding of all of a user's `ready` resources from their
 * already stored `aiDescription` — no re-captioning, hence no new vision call.
 *
 * To run once after an embedding model change: two models do not produce
 * comparable vectors, and mixing them in the same index gives wrong search results
 * without any error reporting it.
 */
export async function recomputeAssetEmbeddingsForUser(userId: string): Promise<{ updated: number; failed: number }> {
  const assets = await db
    .select({ id: brandAssets.id, aiDescription: brandAssets.aiDescription })
    .from(brandAssets)
    .where(and(eq(brandAssets.userId, userId), eq(brandAssets.status, "ready"), eq(brandAssets.archived, false)));

  let updated = 0;
  let failed = 0;
  for (const asset of assets) {
    if (!asset.aiDescription) continue; // nothing to vectorise: the asset was never described
    try {
      const embedding = await embedText(asset.aiDescription);
      await db.update(brandAssets).set({ embedding }).where(eq(brandAssets.id, asset.id));
      updated += 1;
    } catch (err) {
      logger.error("Embedding recomputation failed", err, { assetId: asset.id });
      failed += 1;
    }
  }
  return { updated, failed };
}

export async function archiveAssetForUser(userId: string, assetId: string) {
  const [archived] = await db
    .update(brandAssets)
    .set({ archived: true })
    .where(and(eq(brandAssets.id, assetId), eq(brandAssets.userId, userId)))
    .returning({ id: brandAssets.id });

  if (!archived) {
    throw new ApiError(404, "Visual asset not found.");
  }
}

// --- Cutout (docs/SPEC_COMPOSITION_VISUELLE.md §5.3) ---

/** Maximum long side sent to the service: a post is 1080 px, no point sending more. */
const CUTOUT_MAX_SIDE = 2000;

export class CutoutUnavailableError extends ApiError {
  constructor() {
    super(503, "Background removal is not configured on this server (BACKGROUND_REMOVAL_PROVIDER).");
  }
}

/**
 * Cuts out a photo once and caches the PNG on R2 (`brandAssets.cutoutKey`). The original
 * photo is never modified: only the copy sent to the service is shrunk. An asset's checksum
 * never changes after ingestion (no Drive resynchronisation), so the cache does not
 * need invalidating; if a resynchronisation ever happens, it will have to reset `cutoutKey` to null.
 * Throws `CutoutUnavailableError` (503) without a provider, or the service's error.
 */
export async function ensureCutout(asset: BrandAssetRow): Promise<BrandAssetRow> {
  if (asset.cutoutKey) return asset;
  const remover = getBackgroundRemover();
  if (!remover) throw new CutoutUnavailableError();
  // Two simultaneous requests on the same photo (toggle in the editor + composition) must not
  // pay for more than one call: the in-flight promise is shared per asset, within this process.
  const inFlight = cutoutInFlight.get(asset.id);
  if (inFlight) return inFlight;
  const job = (async () => {
    const { bytes, mimeType } = await fetchAssetBytes(asset);
    const reduced = await sharp(bytes).resize({ width: CUTOUT_MAX_SIDE, height: CUTOUT_MAX_SIDE, fit: "inside", withoutEnlargement: true }).toBuffer();
    const png = await remover.removeBackground(reduced, mimeType);
    const cutoutKey = `assets/${asset.userId}/${asset.id}-cutout.png`;
    await getObjectStorage().upload(cutoutKey, png, "image/png");
    const [updated] = await db.update(brandAssets).set({ cutoutKey }).where(eq(brandAssets.id, asset.id)).returning();
    return updated;
  })().finally(() => cutoutInFlight.delete(asset.id));
  cutoutInFlight.set(asset.id, job);
  return job;
}

const cutoutInFlight = new Map<string, Promise<BrandAssetRow>>();

/** Cutout on the user's request (library, inspector) — asset owned and ready. */
export async function ensureCutoutForUser(userId: string, assetId: string): Promise<BrandAssetRow> {
  const asset = await db.query.brandAssets.findFirst({
    where: and(eq(brandAssets.id, assetId), eq(brandAssets.userId, userId), eq(brandAssets.status, "ready")),
  });
  if (!asset) throw new ApiError(404, "Photo not found or not ready yet.");
  return ensureCutout(asset);
}

/** Bytes of the cutout (PNG) of an asset — `ensureCutout` first if needed. */
export async function fetchCutoutBytes(asset: BrandAssetRow): Promise<{ bytes: Buffer; mimeType: string }> {
  const ready = await ensureCutout(asset);
  return { bytes: await getObjectStorage().download(ready.cutoutKey!), mimeType: "image/png" };
}

/** Shape returned to the client: resolved public URLs, cutout availability. */
export function toApiAsset(asset: BrandAssetRow) {
  const storage = getObjectStorage();
  return {
    ...asset,
    embedding: undefined,
    thumbnailUrl: asset.thumbnailKey ? storage.getPublicUrl(asset.thumbnailKey) : null,
    cutoutUrl: asset.cutoutKey ? storage.getPublicUrl(asset.cutoutKey) : null,
  };
}

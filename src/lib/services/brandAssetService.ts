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
 * Ingestion par upload direct. Contrairement à la source Google Drive (dont l'original reste dans
 * le Drive de l'utilisateur, cf. docs/SPEC_RESSOURCES_VISUELLES.md §4.1), il n'existe ici aucun autre
 * exemplaire de l'image : l'original est donc stocké sur R2 en plus de la vignette.
 */
export async function createUploadedAssets(userId: string, files: UploadedFileInput[]) {
  if (files.length === 0) {
    throw new ApiError(400, "Aucun fichier fourni.");
  }

  const storage = getObjectStorage();
  const created = [];

  for (const file of files) {
    if (!file.mimeType.startsWith("image/")) {
      throw new ApiError(400, `Type de fichier non supporté : "${file.mimeType}".`);
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
 * Ingestion depuis une sélection Google Picker. Contrairement à l'upload direct, l'original n'est
 * pas stocké sur R2 — il reste dans le Drive de l'utilisateur (docs/SPEC_RESSOURCES_VISUELLES.md
 * §4.1) et sera relu à la demande via `files.get` (captioning, génération d'image).
 */
export async function createDriveAssets(userId: string, fileIds: string[]) {
  if (fileIds.length === 0) {
    throw new ApiError(400, "Aucun fichier sélectionné.");
  }

  const accessToken = await getValidAccessToken(userId);
  const storage = getObjectStorage();
  const created = [];

  for (const fileId of fileIds) {
    const metadata = await fetchFileMetadata(fileId, accessToken);
    if (!metadata.mimeType.startsWith("image/")) {
      continue; // ignore silencieusement les non-images d'une sélection Picker (vue DOCS_IMAGES)
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
    throw new ApiError(400, "Aucune image exploitable dans la sélection.");
  }

  return created;
}

export async function listAssetsForUser(userId: string) {
  return db.query.brandAssets.findMany({
    where: and(eq(brandAssets.userId, userId), eq(brandAssets.archived, false)),
    orderBy: (assets, { desc }) => [desc(assets.createdAt)],
  });
}

type BrandAssetRow = typeof brandAssets.$inferSelect;

/** Récupère les bytes d'un asset — R2 pour un upload direct, Drive à la demande sinon. */
export async function fetchAssetBytes(asset: BrandAssetRow): Promise<{ bytes: Buffer; mimeType: string }> {
  if (asset.sourceType === "upload") {
    if (!asset.originalKey) {
      throw new Error(`Asset ${asset.id} : originalKey manquant pour une source "upload".`);
    }
    return { bytes: await getObjectStorage().download(asset.originalKey), mimeType: asset.mimeType };
  }

  if (!asset.externalId) {
    throw new Error(`Asset ${asset.id} : externalId manquant pour une source "google_drive".`);
  }
  const accessToken = await getValidAccessToken(asset.userId);
  return fetchFileMedia(asset.externalId, accessToken);
}

// Unicode property escape (ES2018+) plutôt qu'une plage de caractères combinants écrite en dur —
// plus lisible et sans ambiguïté d'encodage.
function normalizeProductName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

/**
 * Captioning + embedding d'un asset — appelé depuis `after()` juste après l'ingestion (upload ou
 * Picker), jamais rejoué automatiquement (docs/SPEC_RESSOURCES_VISUELLES.md §5.1). Toute erreur
 * laisse l'asset en "pending", sauf perte d'accès Drive avérée ("unreachable").
 */
export async function processAssetCaptioning(assetId: string): Promise<void> {
  const asset = await db.query.brandAssets.findFirst({ where: eq(brandAssets.id, assetId) });
  if (!asset) return; // asset supprimé entretemps

  const userProducts = await db.query.products.findMany({ where: eq(products.userId, asset.userId) });

  let bytes: Buffer;
  let mimeType: string;
  try {
    ({ bytes, mimeType } = await fetchAssetBytes(asset));
  } catch (err) {
    logger.error("Lecture des bytes d'un asset échouée", err, { assetId });
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
 * Recherche sémantique du meilleur BrandAsset pour un script "visual" — filtrage `productId` en
 * amont de la requête vectorielle (docs/SPEC_RESSOURCES_VISUELLES.md §5.3), avec repli sans filtre
 * produit si rien ne matche. Dégradation gracieuse (`null`) si la bibliothèque est vide ou encore
 * en cours de traitement — même pattern que `pickAngleForScript` (src/lib/services/angleService.ts).
 */
export async function findBestBrandAssetForScript(
  userId: string,
  params: Omit<AssetSearchContext, "productName"> & { productId?: string | null }
): Promise<SelectedBrandAsset | null> {
  // Aucune image exploitable : on sort avant l'embedding. C'était l'ordre inverse, et comme rien
  // n'attrapait l'erreur, une génération "visual" échouait en 500 même pour un utilisateur qui
  // n'avait jamais déposé la moindre image (docs/SPEC_RESSOURCES_VISUELLES.md §8.4).
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

  // Une image de référence est un bonus, jamais une condition pour écrire un script : un embedding
  // indisponible dégrade la génération (pas d'image proposée), il ne l'interrompt pas.
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(queryText);
  } catch (err) {
    logger.warn("Embedding de recherche d'image indisponible, génération sans image de référence", {
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
 * Recalcule l'embedding de toutes les ressources `ready` d'un utilisateur à partir de leur
 * `aiDescription` déjà stockée — pas de re-captioning, donc pas de nouvel appel vision.
 *
 * À lancer une fois après un changement de modèle d'embedding : deux modèles ne produisent pas des
 * vecteurs comparables, et les mélanger dans le même index donne des résultats de recherche faux
 * sans qu'aucune erreur ne le signale.
 */
export async function recomputeAssetEmbeddingsForUser(userId: string): Promise<{ updated: number; failed: number }> {
  const assets = await db
    .select({ id: brandAssets.id, aiDescription: brandAssets.aiDescription })
    .from(brandAssets)
    .where(and(eq(brandAssets.userId, userId), eq(brandAssets.status, "ready"), eq(brandAssets.archived, false)));

  let updated = 0;
  let failed = 0;
  for (const asset of assets) {
    if (!asset.aiDescription) continue; // rien à vectoriser : l'asset n'a jamais été décrit
    try {
      const embedding = await embedText(asset.aiDescription);
      await db.update(brandAssets).set({ embedding }).where(eq(brandAssets.id, asset.id));
      updated += 1;
    } catch (err) {
      logger.error("Recalcul d'embedding échoué", err, { assetId: asset.id });
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
    throw new ApiError(404, "Ressource visuelle introuvable.");
  }
}

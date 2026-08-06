import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { brandAssets, generatedImages, scripts } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { getObjectStorage } from "@/lib/storage";
import { generateStagedImage } from "@/lib/llm/providers/geminiImage";
import { checkDriveReachability } from "@/lib/services/googleDriveService";
import { fetchAssetBytes, extFromMime } from "@/lib/services/brandAssetService";

export interface GenerateStagedImageParams {
  assetIds: string[];
  instruction: string;
  scriptId?: string | null;
}

export async function generateStagedImageForUser(userId: string, params: GenerateStagedImageParams) {
  const assets = await db.query.brandAssets.findMany({
    where: and(
      inArray(brandAssets.id, params.assetIds),
      eq(brandAssets.userId, userId),
      eq(brandAssets.status, "ready")
    ),
  });
  if (assets.length === 0) {
    throw new ApiError(404, "Aucune photo de référence valide sélectionnée.");
  }

  // Détecte la perte d'accès en amont plutôt qu'en plein milieu du pipeline (§7.3 du cadrage).
  if (assets.some((a) => a.sourceType === "google_drive")) {
    const reachable = await checkDriveReachability(userId);
    if (!reachable) {
      throw new ApiError(409, "Connexion Google Drive expirée — reconnecte ton compte pour générer une image.");
    }
  }

  const referenceImages = await Promise.all(assets.map((asset) => fetchAssetBytes(asset)));
  const { bytes, mimeType } = await generateStagedImage({ referenceImages, instruction: params.instruction });

  // Aucune transformation des bytes (pas de sharp) — cf. docs/SPEC_RESSOURCES_VISUELLES.md §6.2 (AI
  // Act) : ne pas dépouiller un éventuel filigrane/métadonnées embarqués par l'API.
  const storageKey = `generated/${userId}/${crypto.randomUUID()}.${extFromMime(mimeType)}`;
  await getObjectStorage().upload(storageKey, bytes, mimeType);

  const [generated] = await db
    .insert(generatedImages)
    .values({
      userId,
      scriptId: params.scriptId ?? null,
      sourceAssetIds: params.assetIds,
      mode: "staging",
      instruction: params.instruction,
      storageKey,
      mimeType,
    })
    .returning();

  if (params.scriptId) {
    await db
      .update(scripts)
      .set({ generatedImageId: generated.id })
      .where(and(eq(scripts.id, params.scriptId), eq(scripts.userId, userId)));
  }

  return generated;
}

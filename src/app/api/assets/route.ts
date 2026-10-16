import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import {
  createUploadedAssets,
  listAssetsForUser,
  processAssetCaptioning,
  toApiAsset,
  type UploadedFileInput,
} from "@/lib/services/brandAssetService";
import { isBackgroundRemovalAvailable } from "@/lib/imaging/backgroundRemoval";
import { MAX_ASSET_FILE_SIZE_BYTES, MAX_ASSETS_PER_INGESTION } from "@/lib/validation";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const userId = await requireUserId();
    const assets = await listAssetsForUser(userId);
    // `cutoutAvailable` : dit à l'UI si le détourage est configuré (docs/SPEC_COMPOSITION_VISUELLE.md §5.3).
    return NextResponse.json({ assets: assets.map(toApiAsset), cutoutAvailable: isBackgroundRemovalAvailable() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const formData = await request.formData();
    const entries = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (entries.length === 0) {
      throw new ApiError(400, "Aucun fichier fourni.");
    }
    if (entries.length > MAX_ASSETS_PER_INGESTION) {
      throw new ApiError(400, `Maximum ${MAX_ASSETS_PER_INGESTION} images par envoi.`);
    }
    for (const file of entries) {
      if (file.size > MAX_ASSET_FILE_SIZE_BYTES) {
        throw new ApiError(400, `"${file.name}" dépasse la taille maximale autorisée (10 Mo).`);
      }
    }

    const files: UploadedFileInput[] = await Promise.all(
      entries.map(async (file) => ({
        buffer: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type,
        size: file.size,
      }))
    );

    const created = await createUploadedAssets(userId, files);

    // Réponse immédiate avec la grille de vignettes déjà prête ; captioning + embedding au fil de
    // l'eau après l'envoi de la réponse (docs/SPEC_RESSOURCES_VISUELLES.md §7.2).
    for (const asset of created) {
      after(() =>
        processAssetCaptioning(asset.id).catch((err) =>
          logger.error("Captioning échoué pour un asset", err, { assetId: asset.id })
        )
      );
    }

    return NextResponse.json({ assets: created.map(toApiAsset) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

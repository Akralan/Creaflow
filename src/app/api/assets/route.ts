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
    // `cutoutAvailable`: tells the UI whether background removal is configured (docs/SPEC_COMPOSITION_VISUELLE.md §5.3).
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
      throw new ApiError(400, "No file provided.");
    }
    if (entries.length > MAX_ASSETS_PER_INGESTION) {
      throw new ApiError(400, `Maximum ${MAX_ASSETS_PER_INGESTION} images per upload.`);
    }
    for (const file of entries) {
      if (file.size > MAX_ASSET_FILE_SIZE_BYTES) {
        throw new ApiError(400, `"${file.name}" exceeds the maximum allowed size (10 MB).`);
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

    // Immediate response with the thumbnail grid already ready; captioning + embedding run in the
    // background after the response is sent (docs/SPEC_RESSOURCES_VISUELLES.md §7.2).
    for (const asset of created) {
      after(() =>
        processAssetCaptioning(asset.id).catch((err) =>
          logger.error("Captioning failed for an asset", err, { assetId: asset.id })
        )
      );
    }

    return NextResponse.json({ assets: created.map(toApiAsset) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

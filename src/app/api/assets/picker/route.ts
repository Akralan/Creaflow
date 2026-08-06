import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getObjectStorage } from "@/lib/storage";
import { createDriveAssets, processAssetCaptioning } from "@/lib/services/brandAssetService";
import { MAX_ASSETS_PER_INGESTION } from "@/lib/validation";

const pickerSchema = z.object({
  fileIds: z.array(z.string().min(1)).min(1).max(MAX_ASSETS_PER_INGESTION),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { fileIds } = pickerSchema.parse(await request.json());

    const created = await createDriveAssets(userId, fileIds);

    for (const asset of created) {
      after(() =>
        processAssetCaptioning(asset.id).catch((err) =>
          console.error(`Captioning échoué pour l'asset ${asset.id}`, err)
        )
      );
    }

    const storage = getObjectStorage();
    return NextResponse.json(
      {
        assets: created.map((asset) => ({
          ...asset,
          thumbnailUrl: asset.thumbnailKey ? storage.getPublicUrl(asset.thumbnailKey) : null,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

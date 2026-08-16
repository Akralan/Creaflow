import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getObjectStorage } from "@/lib/storage";
import { generateStagedImageForUser } from "@/lib/services/generatedImageService";
import { MAX_GENERATE_IMAGE_SOURCE_ASSETS } from "@/lib/validation";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const schema = z.object({
  assetIds: z.array(z.uuid()).min(1).max(MAX_GENERATE_IMAGE_SOURCE_ASSETS),
  instruction: z.string().min(1),
  scriptId: z.uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Génération d'image coûteuse (appel modèle image) — limite pour éviter l'abus.
    await enforceRateLimit("image-generate", userId, 10, 60);
    const body = schema.parse(await request.json());

    // Génération synchrone dans le handler — action explicite déclenchée par un clic, pas un
    // traitement de masse comme le captioning (§7.2). Latence de plusieurs secondes possible.
    const generatedImage = await generateStagedImageForUser(userId, body);

    return NextResponse.json(
      { generatedImage: { ...generatedImage, url: getObjectStorage().getPublicUrl(generatedImage.storageKey) } },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

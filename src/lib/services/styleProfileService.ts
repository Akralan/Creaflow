import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, inspirationVideos } from "@/db/schema";
import { analyzeStyle } from "@/lib/llm/styleProfile";
import { ApiError } from "@/lib/api/errors";

export async function updateStyleProfileForUser(userId: string): Promise<void> {
  const videos = await db.query.inspirationVideos.findMany({
    where: eq(inspirationVideos.userId, userId),
  });

  const captions = videos.map((v) => v.captionText).filter((c): c is string => Boolean(c));

  if (captions.length === 0) {
    throw new ApiError(400, "Aucune légende de vidéo d'inspiration disponible pour analyser le style.");
  }

  const styleProfile = await analyzeStyle(captions);

  await db
    .update(creatorProfiles)
    .set({ styleProfile, styleProfileUpdatedAt: new Date() })
    .where(eq(creatorProfiles.userId, userId));
}

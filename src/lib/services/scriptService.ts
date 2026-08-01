import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, products, scripts } from "@/db/schema";
import type { GeneratedScript } from "@/lib/claude/scriptSchema";
import type { ContentCategory, Platform, ScriptGenerationContext } from "@/lib/claude/prompts";
import type { StyleProfile } from "@/lib/claude/styleProfile";
import type { CategoryLabels } from "@/lib/claude/categoryLabels";
import { ApiError } from "@/lib/api/errors";

export async function buildGenerationContext(
  userId: string,
  platform: Platform,
  contentCategory: ContentCategory,
  productId?: string | null
): Promise<ScriptGenerationContext> {
  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, userId),
  });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur (Module A) avant de générer un script.");
  }

  let product = null;
  if (productId) {
    product = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.userId, userId)),
    });
    if (!product) {
      throw new ApiError(404, "Produit introuvable.");
    }
  }

  return {
    creatorProfile: {
      brandName: profile.brandName,
      activityType: profile.activityType,
      tone: profile.tone,
      values: profile.values,
      equipment: profile.equipment,
      weeklyTimeAvailable: profile.weeklyTimeAvailable,
    },
    styleProfile: (profile.styleProfile as StyleProfile | null) ?? null,
    categoryLabels: (profile.categoryLabels as CategoryLabels | null) ?? null,
    product: product
      ? {
          name: product.name,
          description: product.description,
          valueProposition: product.valueProposition,
        }
      : null,
    platform,
    contentCategory,
  };
}

export async function createScriptRecord(
  userId: string,
  platform: Platform,
  contentCategory: ContentCategory,
  productId: string | null,
  generated: GeneratedScript
) {
  const [script] = await db
    .insert(scripts)
    .values({
      userId,
      productId,
      platform,
      title: generated.title,
      hookVisual: generated.hookVisual,
      hookText: generated.hookText,
      hookAudio: generated.hookAudio,
      storyboard: generated.storyboard,
      caption: generated.caption,
      hashtags: generated.hashtags,
      soundRecommendation: generated.soundRecommendation,
      contentCategory,
    })
    .returning();
  return script;
}

export async function updateScriptRecord(scriptId: string, generated: GeneratedScript) {
  const [script] = await db
    .update(scripts)
    .set({
      title: generated.title,
      hookVisual: generated.hookVisual,
      hookText: generated.hookText,
      hookAudio: generated.hookAudio,
      storyboard: generated.storyboard,
      caption: generated.caption,
      hashtags: generated.hashtags,
      soundRecommendation: generated.soundRecommendation,
    })
    .where(eq(scripts.id, scriptId))
    .returning();
  return script;
}

import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, products, contentCategories, contentSeries, scripts } from "@/db/schema";
import type { GeneratedScript } from "@/lib/llm/scriptSchema";
import type { ContentCategoryContext, ContentType, Platform, ScriptGenerationContext } from "@/lib/llm/prompts";
import type { StyleProfile } from "@/lib/llm/styleProfile";
import { buildPerformanceSummary } from "@/lib/services/performanceService";
import { pickAngleForScript } from "@/lib/services/angleService";
import { findBestBrandAssetForScript } from "@/lib/services/brandAssetService";
import { ApiError } from "@/lib/api/errors";

const RECENT_TOPICS_LIMIT = 15;
const SERIES_RECENT_TOPICS_LIMIT = 10;

export async function buildGenerationContext(
  userId: string,
  platform: Platform,
  contentCategoryId: string,
  contentType: ContentType,
  productId?: string | null,
  excludeScriptId?: string | null,
  seriesId?: string | null
): Promise<ScriptGenerationContext> {
  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, userId),
  });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur (Module A) avant de générer un script.");
  }

  const category = await db.query.contentCategories.findFirst({
    where: and(eq(contentCategories.id, contentCategoryId), eq(contentCategories.userId, userId)),
  });
  if (!category) {
    throw new ApiError(404, "Catégorie de contenu introuvable.");
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

  let series = null;
  if (seriesId) {
    const found = await db.query.contentSeries.findFirst({
      where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)),
    });
    if (!found) {
      throw new ApiError(404, "Série introuvable.");
    }
    series = { id: found.id, label: found.label, description: found.description };
  }

  const [recentScripts, performanceSummary, angle] = await Promise.all([
    db.query.scripts.findMany({
      where: and(
        eq(scripts.userId, userId),
        seriesId ? eq(scripts.seriesId, seriesId) : undefined,
        excludeScriptId ? ne(scripts.id, excludeScriptId) : undefined
      ),
      orderBy: desc(scripts.createdAt),
      limit: seriesId ? SERIES_RECENT_TOPICS_LIMIT : RECENT_TOPICS_LIMIT,
      columns: { title: true },
    }),
    buildPerformanceSummary(userId, platform),
    pickAngleForScript(userId, contentCategoryId, excludeScriptId),
  ]);

  // Uniquement pour "visual" — un appel d'embedding serait un coût inutile sur les 2/3 des
  // générations (video/text) qui n'affichent aucune image de référence.
  const brandAsset =
    contentType === "visual"
      ? await findBestBrandAssetForScript(userId, {
          productId,
          categoryLabel: category.label,
          categoryDescription: category.description,
          seriesLabel: series?.label ?? null,
        })
      : null;

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
    product: product
      ? {
          name: product.name,
          description: product.description,
          valueProposition: product.valueProposition,
        }
      : null,
    platform,
    contentCategory: { id: category.id, label: category.label, description: category.description },
    contentType,
    recentTopics: recentScripts.map((s) => s.title),
    performanceSummary,
    angle: angle ? { id: angle.id, label: angle.label, description: angle.description } : null,
    series,
    brandAsset,
  };
}

/** Traduit le script généré (une des 3 formes selon contentType) en colonnes DB —
 *  les champs non pertinents pour ce type sont explicitement mis à null. */
function scriptColumnsFromGenerated(generated: GeneratedScript) {
  return {
    title: generated.title,
    caption: generated.caption,
    hashtags: generated.hashtags,
    contentType: generated.contentType,
    hookVisual: "hookVisual" in generated ? generated.hookVisual : null,
    hookText: "hookText" in generated ? generated.hookText : null,
    hookAudio: "hookAudio" in generated ? generated.hookAudio : null,
    storyboard: "storyboard" in generated ? generated.storyboard : null,
    soundRecommendation: "soundRecommendation" in generated ? generated.soundRecommendation : null,
  };
}

export async function createScriptRecord(
  userId: string,
  platform: Platform,
  contentCategory: ContentCategoryContext,
  productId: string | null,
  generated: GeneratedScript,
  extras?: { angleId?: string | null; seriesId?: string | null; brandAssetId?: string | null }
) {
  const [script] = await db
    .insert(scripts)
    .values({
      userId,
      productId,
      platform,
      contentCategoryId: contentCategory.id,
      angleId: extras?.angleId ?? null,
      seriesId: extras?.seriesId ?? null,
      brandAssetId: extras?.brandAssetId ?? null,
      ...scriptColumnsFromGenerated(generated),
    })
    .returning();
  return { ...script, contentCategory };
}

export async function updateScriptRecord(
  scriptId: string,
  contentCategory: ContentCategoryContext,
  generated: GeneratedScript,
  extras?: { angleId?: string | null; brandAssetId?: string | null }
) {
  const [script] = await db
    .update(scripts)
    .set({
      ...(extras?.angleId !== undefined && { angleId: extras.angleId }),
      ...(extras?.brandAssetId !== undefined && { brandAssetId: extras.brandAssetId }),
      ...scriptColumnsFromGenerated(generated),
    })
    .where(eq(scripts.id, scriptId))
    .returning();
  return { ...script, contentCategory };
}

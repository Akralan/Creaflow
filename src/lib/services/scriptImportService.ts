import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, contentCategories, contentSeries, products, scripts, scriptOriginEnum } from "@/db/schema";
import type { ContentType, Platform } from "@/lib/llm/prompts";
import { ApiError } from "@/lib/api/errors";
import { resolveCategoryForGeneration } from "@/lib/services/seriesService";

export interface ImportScriptParams {
  platform: Platform;
  /** Rôle du post libre ; dérivé de la série si `seriesId` est fourni (docs/SPEC_SERIES_ET_ROLES.md §4.2). */
  contentCategoryId?: string | null;
  contentType: ContentType;
  productId?: string | null;
  seriesId?: string | null;
  /** Mutuellement exclusif avec calendarEntryId — validé côté route (schéma Zod `.refine`). */
  scheduledDate?: string | null; // YYYY-MM-DD
  calendarEntryId?: string | null;
  // Optionnels tous les deux : l'import "écriture ailleurs" (§2) impose les deux côté formulaire ;
  // la naissance paresseuse (§4.5, origin="manual") peut démarrer avec un seul bloc rempli — la
  // validation "au moins un champ de contenu" vit dans importScriptForUser, pas dans le typage.
  title?: string | null;
  caption?: string | null;
  hashtags: string[];
  hookVisual?: string | null;
  hookText?: string | null;
  hookAudio?: string | null;
  storyboard?: { planNumber: number; description: string }[] | null;
  soundRecommendation?: string | null;
}

/**
 * Crée un Script sans passer par le LLM — écriture ailleurs (`origin:"imported"`, docs/SPEC_MATIERE_EDITEUR.md
 * §2) ou naissance paresseuse depuis l'éditeur (`origin:"manual"`, §4.5, réutilisé tel quel à l'étape 2).
 * Aucun `scriptGenerationEvent` : ni appel LLM, ni coût, donc pas de comptage de quota.
 */
export async function importScriptForUser(
  userId: string,
  params: ImportScriptParams,
  origin: (typeof scriptOriginEnum.enumValues)[number] = "imported"
) {
  const hasContent = [
    params.title,
    params.caption,
    params.hookVisual,
    params.hookText,
    params.hookAudio,
  ].some((v) => v?.trim());
  if (!hasContent) {
    throw new ApiError(400, "Ajoute au moins un titre ou un texte avant d'enregistrer.");
  }

  const contentCategoryId = await resolveCategoryForGeneration(userId, {
    seriesId: params.seriesId,
    contentCategoryId: params.contentCategoryId,
  });
  const category = await db.query.contentCategories.findFirst({
    where: and(eq(contentCategories.id, contentCategoryId), eq(contentCategories.userId, userId)),
  });
  if (!category) {
    throw new ApiError(404, "Rôle introuvable.");
  }

  if (params.productId) {
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, params.productId), eq(products.userId, userId)),
    });
    if (!product) {
      throw new ApiError(404, "Sujet introuvable.");
    }
  }

  let seriesId: string | null = null;
  if (params.seriesId) {
    const series = await db.query.contentSeries.findFirst({
      where: and(eq(contentSeries.id, params.seriesId), eq(contentSeries.userId, userId)),
    });
    if (!series) {
      throw new ApiError(404, "Série introuvable.");
    }
    seriesId = series.id;
  }

  let entry: typeof calendarEntries.$inferSelect | null = null;
  if (params.calendarEntryId) {
    entry =
      (await db.query.calendarEntries.findFirst({
        where: and(eq(calendarEntries.id, params.calendarEntryId), eq(calendarEntries.userId, userId)),
      })) ?? null;
    if (!entry) {
      throw new ApiError(404, "Créneau calendrier introuvable.");
    }
    if (entry.scriptId) {
      throw new ApiError(409, "Ce créneau a déjà un script associé.");
    }
  }

  const script = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(scripts)
      .values({
        userId,
        productId: params.productId ?? null,
        platform: params.platform,
        title: params.title ?? null,
        hookVisual: params.hookVisual ?? null,
        hookText: params.hookText ?? null,
        hookAudio: params.hookAudio ?? null,
        storyboard: params.storyboard ?? null,
        caption: params.caption ?? null,
        hashtags: params.hashtags,
        soundRecommendation: params.soundRecommendation ?? null,
        contentCategoryId: category.id,
        seriesId,
        contentType: params.contentType,
        origin,
      })
      .returning();

    if (entry) {
      await tx.update(calendarEntries).set({ scriptId: row.id }).where(eq(calendarEntries.id, entry.id));
    } else if (params.scheduledDate) {
      await tx.insert(calendarEntries).values({
        userId,
        scriptId: row.id,
        platform: params.platform,
        scheduledDate: new Date(`${params.scheduledDate}T00:00:00.000Z`),
        contentCategoryId: category.id,
        seriesId,
      });
    }

    return row;
  });

  return { ...script, contentCategory: { id: category.id, label: category.label, description: category.description } };
}

/**
 * Place un script déjà généré (non planifié) sur une date du calendrier — logique de
 * `POST /api/calendar` extraite ici pour être réutilisée par la génération de série depuis la
 * matière (docs/SPEC_MATIERE_EDITEUR.md §3.8), qui place chaque épisode généré sans dupliquer
 * cette mécanique.
 */
export async function placeScriptOnCalendar(userId: string, scriptId: string, scheduledDate: string) {
  const script = await db.query.scripts.findFirst({ where: and(eq(scripts.id, scriptId), eq(scripts.userId, userId)) });
  if (!script) {
    throw new ApiError(404, "Script introuvable.");
  }

  const existing = await db.query.calendarEntries.findFirst({ where: eq(calendarEntries.scriptId, scriptId) });
  if (existing) {
    throw new ApiError(409, "Ce script est déjà placé au calendrier.");
  }

  const [inserted] = await db
    .insert(calendarEntries)
    .values({
      userId,
      scriptId: script.id,
      platform: script.platform,
      scheduledDate: new Date(`${scheduledDate}T00:00:00.000Z`),
      contentCategoryId: script.contentCategoryId,
      seriesId: script.seriesId,
    })
    .returning();

  return db.query.calendarEntries.findFirst({
    where: eq(calendarEntries.id, inserted.id),
    with: {
      script: { columns: { id: true, title: true, status: true } },
      contentCategory: { columns: { id: true, label: true } },
      series: { columns: { id: true, label: true } },
    },
  });
}

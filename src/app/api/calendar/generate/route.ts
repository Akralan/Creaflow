import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, count, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, sourceMaterials, postingGoals } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import {
  adjustCategoryWeightsForMaterialScarcity,
  categoryWeightsFromCategories,
  distributeCategories,
  distributeDays,
  distributeSeriesOverrides,
  filterByPlatform,
  parseMonth,
  renormalizeCategoryWeights,
  seriesWeightsFromSeries,
  weeksInMonth,
} from "@/lib/services/calendarService";
import { listActiveCategoriesForUser } from "@/lib/services/categoryLabelsService";
import { listActiveSeriesForUser } from "@/lib/services/seriesService";
import { platformLabel } from "@/lib/social/types";
import { ApiError, handleApiError } from "@/lib/api/errors";

const schema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format attendu : YYYY-MM"),
});

// Aiguillage matière×catégorie (docs/SPEC_MATIERE_EDITEUR.md §5.3) : seuil grossier, pas de scope
// par sujet à ce stade (le calendrier n'assigne pas encore de sujet par créneau) — nombre de
// documents déposés par l'utilisateur, tous sujets confondus (plus la structuration en unités
// typées, retirée — un document brut suffit à alimenter une génération).
const MIN_SOURCE_MATERIALS_FOR_SUFFICIENCY = 3;

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { month } = schema.parse(await request.json());
    const { year, monthIndex, daysInMonth } = parseMonth(month);

    const rangeStart = new Date(Date.UTC(year, monthIndex, 1));
    const rangeEnd = new Date(Date.UTC(year, monthIndex + 1, 1));

    const alreadyGenerated = await db.query.calendarEntries.findFirst({
      where: and(
        eq(calendarEntries.userId, userId),
        gte(calendarEntries.scheduledDate, rangeStart),
        lt(calendarEntries.scheduledDate, rangeEnd)
      ),
    });
    if (alreadyGenerated) {
      throw new ApiError(409, "Le calendrier de ce mois est déjà généré.");
    }

    const goals = await db.query.postingGoals.findMany({ where: eq(postingGoals.userId, userId) });
    if (goals.length === 0) {
      throw new ApiError(400, "Définis d'abord tes objectifs hebdomadaires par plateforme (PostingGoal).");
    }

    const activeCategories = await listActiveCategoriesForUser(userId);
    if (activeCategories.length === 0) {
      throw new ApiError(400, "Configure d'abord tes catégories de contenu avant de générer le calendrier.");
    }

    const activeSeries = await listActiveSeriesForUser(userId);

    const hungryIds = new Set(activeCategories.filter((c) => c.materialHungry).map((c) => c.id));
    let hasSufficientMaterial = true;
    if (hungryIds.size > 0) {
      const [{ value }] = await db.select({ value: count() }).from(sourceMaterials).where(eq(sourceMaterials.userId, userId));
      hasSufficientMaterial = value >= MIN_SOURCE_MATERIALS_FOR_SUFFICIENCY;
    }

    const weeks = weeksInMonth(daysInMonth);
    const rowsToInsert = goals.flatMap((goal) => {
      const categoriesForPlatform = filterByPlatform(activeCategories, goal.platform);
      if (categoriesForPlatform.length === 0) {
        throw new ApiError(
          400,
          `Aucune catégorie de contenu n'est configurée pour ${platformLabel(goal.platform)}.`
        );
      }
      const rawWeights = renormalizeCategoryWeights(categoryWeightsFromCategories(categoriesForPlatform));
      // Un jour sec, réserve les catégories gourmandes en matière et réoriente vers les catégories
      // qui tournent sans journal (§5, barreau 3) — jamais de retouche d'un calendrier déjà généré.
      const weights = adjustCategoryWeightsForMaterialScarcity(rawWeights, hungryIds, hasSufficientMaterial);

      const seriesForPlatform = filterByPlatform(activeSeries, goal.platform);
      const seriesWeights = seriesWeightsFromSeries(
        seriesForPlatform.map((s) => ({ id: s.id, weight: s.weight, categoryId: s.category?.id ?? null }))
      );

      const slotCount = Math.round(goal.targetCountPerWeek * weeks);
      const categoryIds = distributeCategories(slotCount, weights);
      const days = distributeDays(slotCount, daysInMonth);
      const seriesOverrides = distributeSeriesOverrides(slotCount, seriesWeights);

      return categoryIds.map((contentCategoryId, i) => {
        const override = seriesOverrides.get(i);
        return {
          userId,
          platform: goal.platform,
          scheduledDate: new Date(Date.UTC(year, monthIndex, days[i])),
          contentCategoryId: override ? override.categoryId : contentCategoryId,
          seriesId: override ? override.seriesId : null,
        };
      });
    });

    const entries = rowsToInsert.length > 0 ? await db.insert(calendarEntries).values(rowsToInsert).returning() : [];

    return NextResponse.json({ entries }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

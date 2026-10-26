import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, contentSeriesCategories, creatorProfiles, products } from "@/db/schema";
import { listActiveCategoriesForUser } from "@/lib/services/categoryLabelsService";
import { syncSeriesSlots } from "@/lib/services/seriesSlotSync";
import { parseStoredRhythm } from "@/lib/seriesRhythm";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

/** Les séries actives. Depuis le 2026-10-26 il n'y en a qu'une par projet (ensureProjectSeries).
 *
 *  Une série porte exactement UN rôle (docs/SPEC_SERIES_ET_ROLES.md §1) — la jonction
 *  contentSeriesCategories est conservée physiquement. `category` est le premier lien trouvé ; une
 *  série sans lien remonte `category: null` et est ignorée par le calendrier. */
export async function listActiveSeriesForUser(userId: string) {
  const rows = await db.query.contentSeries.findMany({
    where: and(eq(contentSeries.userId, userId), eq(contentSeries.archived, false)),
    orderBy: (s, { desc }) => [desc(s.weight)],
    with: {
      contentSeriesCategories: { with: { category: { columns: { id: true, label: true } } } },
      contentSeriesPlatforms: { columns: { platform: true } },
      // Sujet lié (sélecteur de sujet, docs/SPEC_REDACTEUR_EN_CHEF.md) — pour affichage et édition
      // côté écran Direction ; `null` si la série n'est rattachée à aucun sujet précis.
      product: { columns: { id: true, name: true } },
    },
  });
  return rows.map(({ contentSeriesCategories: joins, contentSeriesPlatforms: platformJoins, ...s }) => ({
    ...s,
    category: joins[0]?.category ?? null,
    platforms: platformJoins.map((j) => j.platform),
    rhythm: parseStoredRhythm(s.rhythm),
  }));
}

/** Rôle porté par une série (docs/SPEC_SERIES_ET_ROLES.md §4.2) — `null` si la série n'existe pas
 *  pour cet utilisateur. Sert à dériver le rôle d'un créneau ou d'un script à partir de sa série
 *  au lieu de le demander à l'appelant. */
export async function findSeriesCategoryId(userId: string, seriesId: string): Promise<string | null> {
  const found = await db.query.contentSeries.findFirst({
    where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)),
    columns: { id: true },
    with: { contentSeriesCategories: { columns: { categoryId: true }, limit: 1 } },
  });
  return found?.contentSeriesCategories[0]?.categoryId ?? null;
}

/**
 * Résolution du rôle pour toute porte de génération/import/édition de créneau
 * (docs/SPEC_SERIES_ET_ROLES.md §4.2) : la série impose son rôle ; sans série, le rôle doit être
 * fourni explicitement (post libre). Un `contentCategoryId` contradictoire avec la série est ignoré
 * et journalisé plutôt que refusé — le client d'avant le recadrage envoyait toujours les deux.
 */
export async function resolveCategoryForGeneration(
  userId: string,
  input: { seriesId?: string | null; contentCategoryId?: string | null }
): Promise<string> {
  if (input.seriesId) {
    const seriesCategoryId = await findSeriesCategoryId(userId, input.seriesId);
    if (!seriesCategoryId) {
      throw new ApiError(404, "Series not found or without a role.");
    }
    if (input.contentCategoryId && input.contentCategoryId !== seriesCategoryId) {
      logger.warn("Role conflicts with the series, the series role is kept", {
        seriesId: input.seriesId,
        requested: input.contentCategoryId,
        resolved: seriesCategoryId,
      });
    }
    return seriesCategoryId;
  }
  if (!input.contentCategoryId) {
    throw new ApiError(400, "A free post must have a role (contentCategoryId).");
  }
  return input.contentCategoryId;
}


/** Le nom de l'unique série d'un projet. Il ne s'affiche plus nulle part : un build in public raconte
 *  tout le projet, la série n'est que la mécanique qui pose les créneaux (décision du 2026-10-26). */
export const PROJECT_SERIES_LABEL = "Build in public";

/**
 * Une série par projet, créée par le code et non plus proposée par le modèle (2026-10-26) : le
 * calendrier et le rédacteur passent par une série, mais l'auteur n'en voit ni n'en choisit aucune.
 * Elle porte les jours de publication du profil et le premier rôle actif (un créneau sans rôle n'est
 * pas posé). Rejouable : un projet qui a déjà sa série est laissé tel quel. Renvoie les ids des
 * séries, une par projet.
 */
export async function ensureProjectSeries(userId: string): Promise<string[]> {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { publishingDays: true } });
  if (!profile) {
    throw new ApiError(400, "Set up your creator profile first.");
  }
  const [category] = await listActiveCategoriesForUser(userId);
  if (!category) {
    throw new ApiError(400, "Set up your editorial roles first.");
  }
  const projects = await db.query.products.findMany({ where: eq(products.userId, userId), columns: { id: true } });
  const active = await listActiveSeriesForUser(userId);

  const ids: string[] = [];
  for (const project of projects) {
    const existing = active.find((s) => s.productId === project.id);
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const id = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(contentSeries)
        .values({
          userId,
          label: PROJECT_SERIES_LABEL,
          description: "Everything that happens on the project, told as it happens.",
          weight: 50,
          productId: project.id,
          rhythm: { days: profile.publishingDays, every: 1, anchor: null },
        })
        .returning({ id: contentSeries.id });
      await tx.insert(contentSeriesCategories).values({ seriesId: inserted.id, categoryId: category.id });
      return inserted.id;
    });
    ids.push(id);
  }
  await syncSeriesSlots(userId);
  return ids;
}

/**
 * Les jours de publication, réglés dans Business context, deviennent le rythme de toutes les séries
 * actives et le calendrier suit aussitôt. Avant le 2026-10-26, le profil gardait ces jours sans que
 * le calendrier les lise : seul le rythme de chaque série, réglé dans Direction, posait les créneaux.
 */
export async function applyPublishingDaysToSeries(userId: string, publishingDays: number[]): Promise<void> {
  const active = await listActiveSeriesForUser(userId);
  if (active.length === 0) return;
  await db
    .update(contentSeries)
    .set({ rhythm: { days: publishingDays, every: 1, anchor: null } })
    .where(and(eq(contentSeries.userId, userId), inArray(contentSeries.id, active.map((s) => s.id))));
  await syncSeriesSlots(userId);
}

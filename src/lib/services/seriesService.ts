import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, contentSeriesCategories, contentSeriesPlatforms, creatorProfiles, products } from "@/db/schema";
import { suggestContentSeries } from "@/lib/llm/seriesLabels";
import { listActiveCategoriesForUser, resolveCategoryLabelsToIds } from "@/lib/services/categoryLabelsService";
import { findNarrativeStatesForSeries } from "@/lib/services/narrativeDirector";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Écran Direction — endpoint agrégé (docs/SPEC_REDACTEUR_EN_CHEF.md §6 : "pas de nouvel endpoint de
 *  lecture, étendre l'endpoint agrégé existant") : chaque série porte son état narratif le cas
 *  échéant (`null` si jamais planifiée, ou mode rendez_vous). */
export async function listActiveSeriesForUser(userId: string) {
  const rows = await db.query.contentSeries.findMany({
    where: and(eq(contentSeries.userId, userId), eq(contentSeries.archived, false)),
    orderBy: (s, { desc }) => [desc(s.weight)],
    with: {
      contentSeriesCategories: { with: { category: { columns: { id: true, label: true } } } },
      contentSeriesPlatforms: { columns: { platform: true } },
    },
  });
  const narrativeStates = await findNarrativeStatesForSeries(
    userId,
    rows.map((r) => r.id)
  );
  return rows.map(({ contentSeriesCategories: joins, contentSeriesPlatforms: platformJoins, ...s }) => ({
    ...s,
    categories: joins.map((j) => j.category),
    platforms: platformJoins.map((j) => j.platform),
    narrativeState: narrativeStates.get(s.id) ?? null,
  }));
}

/** Bascule de mode (docs/SPEC_REDACTEUR_EN_CHEF.md §7) — n'affecte jamais l'état narratif existant :
 *  la bascule vers rendez_vous conserve les beats, elle masque seulement la planification côté UI. */
export async function updateSeriesMode(userId: string, seriesId: string, mode: (typeof contentSeries.$inferInsert)["mode"]) {
  const [updated] = await db
    .update(contentSeries)
    .set({ mode })
    .where(and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)))
    .returning();
  if (!updated) {
    throw new ApiError(404, "Série introuvable.");
  }
  return updated;
}

/** Génère un nouveau jeu de séries via l'IA à partir des catégories actives de l'utilisateur.
 *  Archive l'ancien jeu actif plutôt que de le supprimer (mêmes garanties que generateCategoriesForUser). */
export async function generateSeriesForUser(userId: string) {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur avant de générer les séries.");
  }

  const productList = await db.query.products.findMany({ where: eq(products.userId, userId) });
  const activeCategories = await listActiveCategoriesForUser(userId);
  if (activeCategories.length === 0) {
    throw new ApiError(400, "Configure d'abord tes catégories de contenu avant de générer les séries.");
  }

  const suggested = await suggestContentSeries({
    brandName: profile.brandName,
    activityType: profile.activityType,
    tone: profile.tone,
    values: profile.values,
    products: productList.map((p) => ({ name: p.name, description: p.description })),
    categories: activeCategories.map((c) => ({ label: c.label, description: c.description })),
  });

  logger.debug("Réponse brute LLM (suggestion de séries)", { suggested });

  // Résout categoryLabels -> categoryId ; ignore une série suggérée dont aucune catégorie ne matche.
  const resolved = suggested
    .map((s) => ({
      ...s,
      categoryIds: resolveCategoryLabelsToIds(s.categoryLabels, activeCategories),
    }))
    .filter((s) => s.categoryIds.length > 0);

  return db.transaction(async (tx) => {
    await tx
      .update(contentSeries)
      .set({ archived: true })
      .where(and(eq(contentSeries.userId, userId), eq(contentSeries.archived, false)));

    if (resolved.length === 0) return [];

    const inserted = await tx
      .insert(contentSeries)
      .values(resolved.map((s) => ({ userId, label: s.label, description: s.description, weight: s.weight })))
      .returning();

    const joinRows = inserted.flatMap((series, i) =>
      resolved[i].categoryIds.map((categoryId) => ({ seriesId: series.id, categoryId }))
    );
    if (joinRows.length > 0) {
      await tx.insert(contentSeriesCategories).values(joinRows);
    }

    return inserted.map((s, i) => ({
      ...s,
      categories: resolved[i].categoryIds.map((id) => {
        const category = activeCategories.find((c) => c.id === id)!;
        return { id: category.id, label: category.label };
      }),
      // La génération IA ne propose pas de ciblage plateforme — même valeur par défaut que
      // "aucune ligne ContentSeriesPlatforms" (visible sur tous les réseaux), pour que la forme
      // renvoyée reste identique à listActiveSeriesForUser/saveSeriesForUser.
      platforms: [] as string[],
      // Toujours null : ce sont des lignes fraîchement insérées, un état narratif ne peut exister
      // que pour un seriesId déjà connu.
      narrativeState: null,
    }));
  });
}

interface SeriesInput {
  id?: string;
  label: string;
  description: string;
  weight: number;
  categoryIds: string[];
  platforms: string[];
}

/** Insère ou met à jour UNE série et resynchronise ses liens catégories/plateformes, dans la transaction fournie.
 *  Ne touche aucune autre ligne — contrairement à saveSeriesForUser, n'archive rien.
 *  Retourne null si un id est fourni mais ne correspond à aucune série de cet utilisateur. */
export async function upsertSeriesItem(tx: Tx, userId: string, item: SeriesInput): Promise<string | null> {
  let seriesId: string;
  if (item.id) {
    const [updated] = await tx
      .update(contentSeries)
      .set({ label: item.label, description: item.description, weight: item.weight })
      .where(and(eq(contentSeries.id, item.id), eq(contentSeries.userId, userId)))
      .returning();
    if (!updated) return null;
    seriesId = updated.id;
    await tx.delete(contentSeriesCategories).where(eq(contentSeriesCategories.seriesId, seriesId));
    await tx.delete(contentSeriesPlatforms).where(eq(contentSeriesPlatforms.seriesId, seriesId));
  } else {
    const [inserted] = await tx
      .insert(contentSeries)
      .values({ userId, label: item.label, description: item.description, weight: item.weight })
      .returning();
    seriesId = inserted.id;
  }
  if (item.categoryIds.length > 0) {
    await tx.insert(contentSeriesCategories).values(item.categoryIds.map((categoryId) => ({ seriesId, categoryId })));
  }
  if (item.platforms.length > 0) {
    await tx.insert(contentSeriesPlatforms).values(item.platforms.map((platform) => ({ seriesId, platform })));
  }
  return seriesId;
}

/** Enregistrement manuel : diffe contre le jeu actif (même logique que saveCategoriesForUser),
 *  et resynchronise les liens vers les catégories à chaque mise à jour. */
export async function saveSeriesForUser(userId: string, items: SeriesInput[]) {
  const active = await listActiveSeriesForUser(userId);
  const keptIds = new Set(items.filter((s) => s.id).map((s) => s.id as string));

  await db.transaction(async (tx) => {
    const toArchive = active.filter((s) => !keptIds.has(s.id));
    for (const s of toArchive) {
      await tx.update(contentSeries).set({ archived: true }).where(eq(contentSeries.id, s.id));
    }

    for (const item of items) {
      await upsertSeriesItem(tx, userId, item);
    }
  });

  return listActiveSeriesForUser(userId); // relit pour renvoyer la forme jointe à jour
}

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, contentSeriesCategories, creatorProfiles, products } from "@/db/schema";
import { suggestContentSeries } from "@/lib/llm/seriesLabels";
import { listActiveCategoriesForUser } from "@/lib/services/categoryLabelsService";
import { ApiError } from "@/lib/api/errors";

export async function listActiveSeriesForUser(userId: string) {
  const rows = await db.query.contentSeries.findMany({
    where: and(eq(contentSeries.userId, userId), eq(contentSeries.archived, false)),
    orderBy: (s, { desc }) => [desc(s.weight)],
    with: {
      contentSeriesCategories: { with: { category: { columns: { id: true, label: true } } } },
    },
  });
  return rows.map(({ contentSeriesCategories: joins, ...s }) => ({
    ...s,
    categories: joins.map((j) => j.category),
  }));
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

  // Résout categoryLabels -> categoryId par correspondance exacte (insensible à la casse) ;
  // ignore une série suggérée dont aucune catégorie ne matche.
  const byLabel = new Map(activeCategories.map((c) => [c.label.trim().toLowerCase(), c.id]));
  const resolved = suggested
    .map((s) => ({
      ...s,
      categoryIds: s.categoryLabels
        .map((l) => byLabel.get(l.trim().toLowerCase()))
        .filter((id): id is string => !!id),
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
    }));
  });
}

interface SeriesInput {
  id?: string;
  label: string;
  description: string;
  weight: number;
  categoryIds: string[];
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
      let seriesId: string;
      if (item.id) {
        const [updated] = await tx
          .update(contentSeries)
          .set({ label: item.label, description: item.description, weight: item.weight })
          .where(and(eq(contentSeries.id, item.id), eq(contentSeries.userId, userId)))
          .returning();
        if (!updated) continue;
        seriesId = updated.id;
        await tx.delete(contentSeriesCategories).where(eq(contentSeriesCategories.seriesId, seriesId));
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
    }
  });

  return listActiveSeriesForUser(userId); // relit pour renvoyer la forme jointe à jour
}

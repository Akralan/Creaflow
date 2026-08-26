import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, products, contentCategories, contentCategoriesPlatforms, contentSeriesCategories } from "@/db/schema";
import { suggestContentCategories, normalizeCategoryWeights, type CategoryEntry } from "@/lib/llm/categoryLabels";
import { ApiError } from "@/lib/api/errors";

export async function listActiveCategoriesForUser(userId: string) {
  const rows = await db.query.contentCategories.findMany({
    where: and(eq(contentCategories.userId, userId), eq(contentCategories.archived, false)),
    orderBy: (c, { desc }) => [desc(c.weight)],
    with: { contentCategoriesPlatforms: { columns: { platform: true } } },
  });
  return rows.map(({ contentCategoriesPlatforms: joins, ...c }) => ({
    ...c,
    platforms: joins.map((j) => j.platform),
  }));
}

/** Résout des libellés de catégorie vers leurs ids, correspondance exacte insensible à la casse.
 *  Ignore silencieusement un libellé qui ne matche aucune catégorie active fournie. */
export function resolveCategoryLabelsToIds(
  categoryLabels: string[],
  activeCategories: Array<{ id: string; label: string }>
): string[] {
  const byLabel = new Map(activeCategories.map((c) => [c.label.trim().toLowerCase(), c.id]));
  return categoryLabels.map((l) => byLabel.get(l.trim().toLowerCase())).filter((id): id is string => !!id);
}

/** Variante à un seul libellé (docs/SPEC_SERIES_ET_ROLES.md §3 : une série porte exactement un rôle).
 *  `null` si le libellé ne matche aucune catégorie active. */
export function resolveCategoryLabelToId(
  categoryLabel: string,
  activeCategories: Array<{ id: string; label: string }>
): string | null {
  return resolveCategoryLabelsToIds([categoryLabel], activeCategories)[0] ?? null;
}

/** Génère un nouveau jeu de catégories via l'IA. Archive l'ancien jeu actif plutôt que de le supprimer,
 *  pour ne jamais casser les scripts/créneaux calendrier qui le référencent déjà. */
export async function generateCategoriesForUser(userId: string) {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur avant de générer les catégories.");
  }

  const productList = await db.query.products.findMany({ where: eq(products.userId, userId) });

  const suggested = await suggestContentCategories({
    brandName: profile.brandName,
    activityType: profile.activityType,
    tone: profile.tone,
    values: profile.values,
    products: productList.map((p) => ({ name: p.name, description: p.description })),
  });

  return db.transaction(async (tx) => {
    await tx
      .update(contentCategories)
      .set({ archived: true })
      .where(and(eq(contentCategories.userId, userId), eq(contentCategories.archived, false)));

    const inserted = await tx
      .insert(contentCategories)
      .values(suggested.map((c) => ({ userId, ...c })))
      .returning();
    // La génération IA ne propose pas de ciblage plateforme — même forme que listActiveCategoriesForUser
    // (qui joint contentCategoriesPlatforms), sinon le front plante sur `.platforms.length` (undefined).
    return inserted.map((c) => ({ ...c, platforms: [] as string[] }));
  });
}

interface CategoryInput {
  id?: string;
  label: string;
  description: string;
  weight: number;
  platforms: string[];
  /** Aiguillage matière×catégorie (docs/SPEC_MATIERE_EDITEUR.md §5.3) — curatable manuellement ici. */
  materialHungry?: boolean;
}

/** Enregistrement manuel : met à jour les catégories existantes, insère les nouvelles,
 *  archive celles qui ne sont plus présentes dans la liste envoyée par l'utilisateur. */
export async function saveCategoriesForUser(userId: string, items: CategoryInput[]) {
  const normalized = normalizeCategoryWeights(items as CategoryEntry[]).map((c, i) => ({
    ...c,
    id: items[i].id,
    platforms: items[i].platforms,
    materialHungry: items[i].materialHungry ?? false,
  }));

  const active = await listActiveCategoriesForUser(userId);
  const keptIds = new Set(normalized.filter((c) => c.id).map((c) => c.id as string));
  const toArchive = active.filter((c) => !keptIds.has(c.id));

  // docs/SPEC_SERIES_ET_ROLES.md §7 : un rôle porté par une série active ne peut pas être archivé —
  // la série se retrouverait sans rôle (invariant "exactement un rôle par série") et disparaîtrait
  // silencieusement de la génération du calendrier.
  if (toArchive.length > 0) {
    const blocking = await db.query.contentSeriesCategories.findMany({
      where: inArray(
        contentSeriesCategories.categoryId,
        toArchive.map((c) => c.id)
      ),
      with: { series: { columns: { label: true, archived: true } }, category: { columns: { label: true } } },
    });
    const activeBlocking = blocking.filter((b) => !b.series.archived);
    if (activeBlocking.length > 0) {
      const detail = activeBlocking.map((b) => `« ${b.category.label} » (série « ${b.series.label} »)`).join(", ");
      throw new ApiError(400, `Impossible de retirer un rôle encore utilisé par une série active : ${detail}.`);
    }
  }

  return db.transaction(async (tx) => {
    for (const c of toArchive) {
      await tx.update(contentCategories).set({ archived: true }).where(eq(contentCategories.id, c.id));
    }

    const results = [];
    for (const c of normalized) {
      let categoryId: string;
      if (c.id) {
        const [updated] = await tx
          .update(contentCategories)
          .set({ label: c.label, description: c.description, weight: c.weight, materialHungry: c.materialHungry })
          .where(and(eq(contentCategories.id, c.id), eq(contentCategories.userId, userId)))
          .returning();
        if (!updated) continue;
        categoryId = updated.id;
        await tx.delete(contentCategoriesPlatforms).where(eq(contentCategoriesPlatforms.categoryId, categoryId));
        // Même forme que listActiveCategoriesForUser/generateCategoriesForUser (platforms rattaché) —
        // sinon le front plante sur `.platforms.length` (undefined) juste après un enregistrement réussi.
        results.push({ ...updated, platforms: c.platforms });
      } else {
        const [inserted] = await tx
          .insert(contentCategories)
          .values({ userId, label: c.label, description: c.description, weight: c.weight, materialHungry: c.materialHungry })
          .returning();
        categoryId = inserted.id;
        results.push({ ...inserted, platforms: c.platforms });
      }
      if (c.platforms.length > 0) {
        await tx.insert(contentCategoriesPlatforms).values(c.platforms.map((platform) => ({ categoryId, platform })));
      }
    }
    return results;
  });
}

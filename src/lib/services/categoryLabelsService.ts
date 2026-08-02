import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, products, contentCategories } from "@/db/schema";
import { suggestContentCategories, normalizeCategoryWeights, type CategoryEntry } from "@/lib/llm/categoryLabels";
import { ApiError } from "@/lib/api/errors";

export async function listActiveCategoriesForUser(userId: string) {
  return db.query.contentCategories.findMany({
    where: and(eq(contentCategories.userId, userId), eq(contentCategories.archived, false)),
    orderBy: (c, { desc }) => [desc(c.weight)],
  });
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

    return tx
      .insert(contentCategories)
      .values(suggested.map((c) => ({ userId, ...c })))
      .returning();
  });
}

interface CategoryInput {
  id?: string;
  label: string;
  description: string;
  weight: number;
}

/** Enregistrement manuel : met à jour les catégories existantes, insère les nouvelles,
 *  archive celles qui ne sont plus présentes dans la liste envoyée par l'utilisateur. */
export async function saveCategoriesForUser(userId: string, items: CategoryInput[]) {
  const normalized = normalizeCategoryWeights(items as CategoryEntry[]).map((c, i) => ({ ...c, id: items[i].id }));

  const active = await listActiveCategoriesForUser(userId);
  const keptIds = new Set(normalized.filter((c) => c.id).map((c) => c.id as string));

  return db.transaction(async (tx) => {
    const toArchive = active.filter((c) => !keptIds.has(c.id));
    for (const c of toArchive) {
      await tx.update(contentCategories).set({ archived: true }).where(eq(contentCategories.id, c.id));
    }

    const results = [];
    for (const c of normalized) {
      if (c.id) {
        const [updated] = await tx
          .update(contentCategories)
          .set({ label: c.label, description: c.description, weight: c.weight })
          .where(and(eq(contentCategories.id, c.id), eq(contentCategories.userId, userId)))
          .returning();
        if (updated) results.push(updated);
      } else {
        const [inserted] = await tx
          .insert(contentCategories)
          .values({ userId, label: c.label, description: c.description, weight: c.weight })
          .returning();
        results.push(inserted);
      }
    }
    return results;
  });
}

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

/** Resolves category labels to their ids, exact case-insensitive match.
 *  Silently ignores a label that matches no supplied active category. */
export function resolveCategoryLabelsToIds(
  categoryLabels: string[],
  activeCategories: Array<{ id: string; label: string }>
): string[] {
  const byLabel = new Map(activeCategories.map((c) => [c.label.trim().toLowerCase(), c.id]));
  return categoryLabels.map((l) => byLabel.get(l.trim().toLowerCase())).filter((id): id is string => !!id);
}

/** Single-label variant (docs/SPEC_SERIES_ET_ROLES.md §3: a series carries exactly one role).
 *  `null` if the label matches no active category. */
export function resolveCategoryLabelToId(
  categoryLabel: string,
  activeCategories: Array<{ id: string; label: string }>
): string | null {
  return resolveCategoryLabelsToIds([categoryLabel], activeCategories)[0] ?? null;
}

/** Generates a new set of categories via AI. Archives the old active set rather than deleting it,
 *  so as never to break the scripts/calendar slots that already reference it. */
export async function generateCategoriesForUser(userId: string) {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Set up your creator profile first before generating categories.");
  }

  const productList = await db.query.products.findMany({ where: eq(products.userId, userId) });

  const suggested = await suggestContentCategories({
    brandName: profile.brandName,
    activityType: profile.activityType,
    expectations: profile.expectations,
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
    // AI generation does not propose platform targeting — same shape as listActiveCategoriesForUser
    // (which joins contentCategoriesPlatforms), otherwise the front end crashes on `.platforms.length` (undefined).
    return inserted.map((c) => ({ ...c, platforms: [] as string[] }));
  });
}

interface CategoryInput {
  id?: string;
  label: string;
  description: string;
  weight: number;
  platforms: string[];
  /** Material×category routing (docs/SPEC_MATIERE_EDITEUR.md §5.3) — manually curatable here. */
  materialHungry?: boolean;
}

/** Manual save: updates existing categories, inserts new ones,
 *  archives those no longer present in the list sent by the user. */
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

  // docs/SPEC_SERIES_ET_ROLES.md §7: a role carried by an active series cannot be archived —
  // the series would be left without a role ("exactly one role per series" invariant) and would silently
  // disappear from calendar generation.
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
      const detail = activeBlocking.map((b) => `"${b.category.label}" (series "${b.series.label}")`).join(", ");
      throw new ApiError(400, `Cannot remove a role still used by an active series: ${detail}.`);
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
        // Same shape as listActiveCategoriesForUser/generateCategoriesForUser (platforms attached) —
        // otherwise the front end crashes on `.platforms.length` (undefined) right after a successful save.
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

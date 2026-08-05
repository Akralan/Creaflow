import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { contentAngles, creatorProfiles, products, scripts } from "@/db/schema";
import { suggestContentAngles } from "@/lib/llm/angleLabels";
import { selectLeastRecentlyUsedAngle } from "@/lib/services/angleSelection";
import { ApiError } from "@/lib/api/errors";

const ANGLE_HISTORY_LIMIT = 30;

export function listActiveAnglesForUser(userId: string) {
  return db.query.contentAngles.findMany({
    where: and(eq(contentAngles.userId, userId), eq(contentAngles.archived, false)),
    orderBy: (a, { asc }) => [asc(a.createdAt)], // ordre stable pour les égalités dans selectLeastRecentlyUsedAngle
  });
}

/** Insère ou met à jour UN angle. Pas de logique d'archivage des autres angles (contrairement aux
 *  catégories, il n'y a pas d'invariant de somme à préserver entre angles actifs). */
export async function upsertAngleItem(userId: string, item: { id?: string; label: string; description: string }) {
  if (item.id) {
    const [updated] = await db
      .update(contentAngles)
      .set({ label: item.label, description: item.description })
      .where(and(eq(contentAngles.id, item.id), eq(contentAngles.userId, userId)))
      .returning();
    return updated ?? null;
  }
  const [inserted] = await db
    .insert(contentAngles)
    .values({ userId, label: item.label, description: item.description })
    .returning();
  return inserted;
}

/** Même pattern que generateCategoriesForUser : archive l'ancien jeu actif, insère le nouveau. */
export async function generateAnglesForUser(userId: string) {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur avant de générer les angles.");
  }

  const productList = await db.query.products.findMany({ where: eq(products.userId, userId) });

  const suggested = await suggestContentAngles({
    brandName: profile.brandName,
    activityType: profile.activityType,
    tone: profile.tone,
    values: profile.values,
    products: productList.map((p) => ({ name: p.name, description: p.description })),
  });

  return db.transaction(async (tx) => {
    await tx
      .update(contentAngles)
      .set({ archived: true })
      .where(and(eq(contentAngles.userId, userId), eq(contentAngles.archived, false)));

    return tx
      .insert(contentAngles)
      .values(suggested.map((a) => ({ userId, ...a })))
      .returning();
  });
}

/** Cœur de la mécanique anti-répétition : choisit l'angle à imposer pour ce script —
 *  celui le moins récemment utilisé par l'utilisateur dans la même catégorie de contenu.
 *  excludeScriptId : même rôle que dans buildGenerationContext (régénération — ne pas compter le script qu'on remplace). */
export async function pickAngleForScript(
  userId: string,
  contentCategoryId: string,
  excludeScriptId?: string | null
) {
  const activeAngles = await listActiveAnglesForUser(userId);
  if (activeAngles.length === 0) return null; // dégradation gracieuse (avant génération d'angles / utilisateur legacy)

  const recent = await db.query.scripts.findMany({
    where: and(
      eq(scripts.userId, userId),
      eq(scripts.contentCategoryId, contentCategoryId),
      isNotNull(scripts.angleId),
      excludeScriptId ? ne(scripts.id, excludeScriptId) : undefined
    ),
    orderBy: desc(scripts.createdAt),
    columns: { angleId: true },
    limit: ANGLE_HISTORY_LIMIT,
  });

  return selectLeastRecentlyUsedAngle(activeAngles, recent.map((r) => r.angleId as string));
}

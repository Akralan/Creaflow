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
    orderBy: (a, { asc }) => [asc(a.createdAt)], // stable order for ties in selectLeastRecentlyUsedAngle
  });
}

/** Inserts or updates ONE angle. No logic archiving the other angles (unlike
 *  categories, there is no sum invariant to preserve between active angles). */
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

/** Same pattern as generateCategoriesForUser: archives the old active set, inserts the new one. */
/** Archiving ONE angle (docs/SPEC_ASSISTANT_AGENTIQUE.md §4.1) — never deleted, scripts
 *  already generated reference the angle that produced them. */
export async function archiveAngleForUser(userId: string, angleId: string) {
  const [archived] = await db
    .update(contentAngles)
    .set({ archived: true })
    .where(and(eq(contentAngles.id, angleId), eq(contentAngles.userId, userId)))
    .returning();
  if (!archived) {
    throw new ApiError(404, "Angle not found.");
  }
  return archived;
}

export async function generateAnglesForUser(userId: string) {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Set up your creator profile first before generating angles.");
  }

  const productList = await db.query.products.findMany({ where: eq(products.userId, userId) });

  const suggested = await suggestContentAngles({
    brandName: profile.brandName,
    activityType: profile.activityType,
    expectations: profile.expectations,
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

/** Core of the anti-repetition mechanism: picks the angle to impose for this script —
 *  the one least recently used by the user in the same content category.
 *  excludeScriptId: same role as in buildGenerationContext (regeneration — do not count the script being replaced). */
export async function pickAngleForScript(
  userId: string,
  contentCategoryId: string,
  excludeScriptId?: string | null
) {
  const activeAngles = await listActiveAnglesForUser(userId);
  if (activeAngles.length === 0) return null; // graceful degradation (before angles are generated / legacy user)

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

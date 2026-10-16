import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { creatorProfiles, postingGoals } from "@/db/schema";
import { DEFAULT_PUBLISHING_DAYS, platformSchema } from "@/lib/validation";

// Une plateforme est active ou coupée : le nombre de posts par semaine n'est plus réglé à la main.
export const postingGoalPayloadSchema = z.object({
  platform: platformSchema,
  active: z.boolean(),
});

/**
 * Le nombre de posts par semaine n'est plus réglé à la main : c'est le nombre de jours de
 * publication cochés (docs/SPEC_ONBOARDING_MVP.md §3). Recalé sur toutes les plateformes ACTIVES
 * (objectif > 0) à chaque changement de jours ; une plateforme coupée reste à 0.
 */
export async function syncGoalCountsToPublishingDays(userId: string, publishingDays: number[]) {
  await db
    .update(postingGoals)
    .set({ targetCountPerWeek: publishingDays.length })
    .where(and(eq(postingGoals.userId, userId), gt(postingGoals.targetCountPerWeek, 0)));
}

/** Upsert par (userId, platform) — un objectif par plateforme, pas de notion de création distincte. */
export async function savePostingGoalForUser(userId: string, platform: string, targetCountPerWeek: number) {
  const existing = await db.query.postingGoals.findFirst({
    where: and(eq(postingGoals.userId, userId), eq(postingGoals.platform, platform)),
  });

  const [goal] = existing
    ? await db
        .update(postingGoals)
        .set({ targetCountPerWeek })
        .where(eq(postingGoals.id, existing.id))
        .returning()
    : await db.insert(postingGoals).values({ userId, platform, targetCountPerWeek }).returning();

  return goal;
}

/**
 * Active (objectif = nombre de jours de publication du profil, jours par défaut sans profil) ou
 * coupe (objectif = 0) une plateforme.
 */
export async function setPlatformActiveForUser(userId: string, platform: string, active: boolean) {
  if (!active) return savePostingGoalForUser(userId, platform, 0);
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  const days = profile?.publishingDays ?? DEFAULT_PUBLISHING_DAYS;
  return savePostingGoalForUser(userId, platform, days.length);
}

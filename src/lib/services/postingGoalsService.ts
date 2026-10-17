import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { creatorProfiles, postingGoals } from "@/db/schema";
import { DEFAULT_PUBLISHING_DAYS, platformSchema } from "@/lib/validation";
import { syncSeriesSlots } from "@/lib/services/seriesSlotSync";

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
 * coupe (objectif = 0) une plateforme. Le calendrier suit aussitôt : les séries posent leurs
 * créneaux sur un réseau activé, et retirent les vides d'un réseau coupé (docs/SPEC_RYTHME_DES_SERIES.md §3).
 */
export async function setPlatformActiveForUser(userId: string, platform: string, active: boolean) {
  const profile = active ? await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) }) : null;
  const days = profile?.publishingDays ?? DEFAULT_PUBLISHING_DAYS;
  const goal = await savePostingGoalForUser(userId, platform, active ? days.length : 0);
  await syncSeriesSlots(userId);
  return goal;
}

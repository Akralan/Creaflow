import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { creatorProfiles, postingGoals } from "@/db/schema";
import { DEFAULT_PUBLISHING_DAYS, platformSchema } from "@/lib/validation";
import { syncSeriesSlots } from "@/lib/services/seriesSlotSync";

// A platform is on or off: the number of posts per week is no longer set by hand.
export const postingGoalPayloadSchema = z.object({
  platform: platformSchema,
  active: z.boolean(),
});

/**
 * The number of posts per week is no longer set by hand: it is the number of publishing days
 * checked (docs/SPEC_ONBOARDING_MVP.md §3). Realigned on all ACTIVE platforms
 * (goal > 0) at each change of days; a switched-off platform stays at 0.
 */
export async function syncGoalCountsToPublishingDays(userId: string, publishingDays: number[]) {
  await db
    .update(postingGoals)
    .set({ targetCountPerWeek: publishingDays.length })
    .where(and(eq(postingGoals.userId, userId), gt(postingGoals.targetCountPerWeek, 0)));
}

/** Upsert by (userId, platform) — one goal per platform, no distinct notion of creation. */
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
 * Turns on (goal = number of the profile's publishing days, default days without a profile) or
 * turns off (goal = 0) a platform. The calendar follows right away: series place their
 * slots on an enabled network, and remove the empty ones from a disabled network (docs/SPEC_RYTHME_DES_SERIES.md §3).
 */
export async function setPlatformActiveForUser(userId: string, platform: string, active: boolean) {
  const profile = active ? await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) }) : null;
  const days = profile?.publishingDays ?? DEFAULT_PUBLISHING_DAYS;
  const goal = await savePostingGoalForUser(userId, platform, active ? days.length : 0);
  await syncSeriesSlots(userId);
  return goal;
}

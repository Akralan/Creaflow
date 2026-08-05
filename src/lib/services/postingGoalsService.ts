import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { postingGoals } from "@/db/schema";
import { platformSchema } from "@/lib/validation";

export const postingGoalPayloadSchema = z.object({
  platform: platformSchema,
  targetCountPerWeek: z.number().min(0).max(30).multipleOf(0.5),
});

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

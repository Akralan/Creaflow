import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { postingGoals } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { platformSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";

const goalSchema = z.object({
  platform: platformSchema,
  targetCountPerWeek: z.number().int().min(0).max(30),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const goals = await db.query.postingGoals.findMany({ where: eq(postingGoals.userId, userId) });
    return NextResponse.json({ goals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { platform, targetCountPerWeek } = goalSchema.parse(await request.json());

    const existing = await db.query.postingGoals.findFirst({
      where: and(eq(postingGoals.userId, userId), eq(postingGoals.platform, platform)),
    });

    const [goal] = existing
      ? await db
          .update(postingGoals)
          .set({ targetCountPerWeek })
          .where(eq(postingGoals.id, existing.id))
          .returning()
      : await db
          .insert(postingGoals)
          .values({ userId, platform, targetCountPerWeek })
          .returning();

    return NextResponse.json({ goal }, { status: existing ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

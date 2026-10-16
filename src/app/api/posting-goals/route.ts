import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { postingGoals } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { postingGoalPayloadSchema, setPlatformActiveForUser } from "@/lib/services/postingGoalsService";
import { handleApiError } from "@/lib/api/errors";

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
    const { platform, active } = postingGoalPayloadSchema.parse(await request.json());
    const goal = await setPlatformActiveForUser(userId, platform, active);
    return NextResponse.json({ goal });
  } catch (error) {
    return handleApiError(error);
  }
}

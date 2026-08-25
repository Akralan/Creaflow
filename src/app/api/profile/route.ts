import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";

const profileSchema = z.object({
  brandName: z.string().min(1),
  activityType: z.string().min(1),
  tone: z.string().optional(),
  values: z.string().optional(),
  equipment: z.array(z.string()).optional(),
  weeklyTimeAvailable: z.string().optional(),
  targetAudience: z.string().optional(),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const profile = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.userId, userId),
    });
    return NextResponse.json({ profile: profile ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = profileSchema.parse(await request.json());

    const existing = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.userId, userId),
    });

    const [profile] = existing
      ? await db
          .update(creatorProfiles)
          .set(body)
          .where(eq(creatorProfiles.userId, userId))
          .returning()
      : await db
          .insert(creatorProfiles)
          .values({ userId, ...body })
          .returning();

    return NextResponse.json({ profile }, { status: existing ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

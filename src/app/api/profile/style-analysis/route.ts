import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { updateStyleProfileForUser } from "@/lib/services/styleProfileService";
import { handleApiError } from "@/lib/api/errors";

export async function POST() {
  try {
    const userId = await requireUserId();
    await updateStyleProfileForUser(userId);
    const profile = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.userId, userId),
    });
    return NextResponse.json({ profile });
  } catch (error) {
    return handleApiError(error);
  }
}

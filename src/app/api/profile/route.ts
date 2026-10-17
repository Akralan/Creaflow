import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, users } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { listConnectedProviders } from "@/lib/services/oauthAccountService";
import { getStyleLearningStatus } from "@/lib/services/styleLearningService";
import { handleApiError } from "@/lib/api/errors";
import { expectationsSchema, postLanguageSchema, publishingDaysSchema } from "@/lib/validation";
import { syncGoalCountsToPublishingDays } from "@/lib/services/postingGoalsService";

const profileSchema = z.object({
  brandName: z.string().min(1),
  activityType: z.string().min(1),
  targetAudience: z.string().optional(),
  expectations: expectationsSchema.optional(),
  language: postLanguageSchema.nullable().optional(),
  publishingDays: publishingDaysSchema.optional(),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const profile = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.userId, userId),
    });
    // The track decides which onboarding is shown — exposed here rather than via a dedicated endpoint because
    // /onboarding and /login already call getProfile on mount.
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { vertical: true },
    });
    // Exposed here for the same reason as the vertical: the screens that need it (settings >
    // Topics, onboarding) already call getProfile. It is THIS list, not the vertical, that
    // says which selector to show — "dev" covers GitHub as well as Linear
    // (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.2).
    const connectedProviders = await listConnectedProviders(userId);
    // Counter "scripts corrected since the last style analysis" — exposed here because the
    // two screens that display it (Settings, editor) already call getProfile
    // (docs/SPEC_APPRENTISSAGE_STYLE.md §5.3).
    const styleLearning = await getStyleLearningStatus(userId);
    return NextResponse.json({
      profile: profile ?? null,
      styleLearning,
      vertical: user?.vertical ?? "creator",
      connectedProviders,
      // Kept so as not to break existing callers until they have switched to
      // connectedProviders.
      githubConnected: connectedProviders.some((provider) => provider.id === "github"),
    });
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

    if (body.publishingDays) await syncGoalCountsToPublishingDays(userId, body.publishingDays);

    return NextResponse.json({ profile }, { status: existing ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

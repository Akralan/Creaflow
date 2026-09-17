import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, users } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { listConnectedProviders } from "@/lib/services/oauthAccountService";
import { getStyleLearningStatus } from "@/lib/services/styleLearningService";
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
    // Le track décide quel onboarding s'affiche — exposé ici plutôt que via un endpoint dédié parce
    // que /onboarding et /login appellent déjà getProfile au montage.
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { vertical: true },
    });
    // Exposé ici pour la même raison que la verticale : les écrans qui en ont besoin (paramètres >
    // Sujets, l'onboarding) appellent déjà getProfile. C'est CETTE liste, et non la verticale, qui
    // dit quel sélecteur afficher — "dev" couvre GitHub comme Linear
    // (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.2).
    const connectedProviders = await listConnectedProviders(userId);
    // Compteur « scripts corrigés depuis la dernière analyse de style » — exposé ici parce que les
    // deux écrans qui l'affichent (Paramètres, éditeur) appellent déjà getProfile
    // (docs/SPEC_APPRENTISSAGE_STYLE.md §5.3).
    const styleLearning = await getStyleLearningStatus(userId);
    return NextResponse.json({
      profile: profile ?? null,
      styleLearning,
      vertical: user?.vertical ?? "creator",
      connectedProviders,
      // Conservé pour ne pas casser les appelants existants tant qu'ils n'ont pas basculé sur
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

    return NextResponse.json({ profile }, { status: existing ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

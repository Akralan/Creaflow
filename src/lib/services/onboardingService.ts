import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, postingGoals } from "@/db/schema";
import type { ExtractedOnboardingProfile } from "@/lib/llm/onboardingChat";
import { generateCategoriesForUser, listActiveCategoriesForUser } from "@/lib/services/categoryLabelsService";
import { generateAnglesForUser, listActiveAnglesForUser } from "@/lib/services/angleService";
import { generateSeriesForUser, listActiveSeriesForUser } from "@/lib/services/seriesService";
import { isKnownPlatform } from "@/lib/social/types";
import { ApiError } from "@/lib/api/errors";

const DEFAULT_WEEKLY_TARGET = 2;

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Fusionne les champs extraits par le tour de chat courant sur l'état accumulé —
 *  n'écrase jamais un champ déjà connu si le LLM omet ou renvoie une valeur vide à ce tour. */
export function mergeExtractedProfile(
  prev: ExtractedOnboardingProfile,
  next: ExtractedOnboardingProfile
): ExtractedOnboardingProfile {
  const merged: ExtractedOnboardingProfile = { ...prev };
  for (const key of Object.keys(next) as Array<keyof ExtractedOnboardingProfile>) {
    const value = next[key];
    if (hasValue(value)) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

/** Déclenché quand le chat d'onboarding marque complete=true : persiste le profil,
 *  génère les catégories de contenu (si aucune n'existe déjà) et pré-remplit les
 *  objectifs de publication pour les plateformes suggérées. */
export async function finalizeOnboarding(userId: string, extracted: ExtractedOnboardingProfile): Promise<void> {
  if (!extracted.brandName || !extracted.activityType) {
    throw new ApiError(400, "Profil incomplet : impossible de finaliser l'onboarding.");
  }

  const existingProfile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  const profileValues = {
    brandName: extracted.brandName,
    activityType: extracted.activityType,
    tone: extracted.tone ?? null,
    values: extracted.values ?? null,
    equipment: extracted.equipment ?? null,
    weeklyTimeAvailable: extracted.weeklyTimeAvailable ?? null,
  };
  if (existingProfile) {
    await db.update(creatorProfiles).set(profileValues).where(eq(creatorProfiles.userId, userId));
  } else {
    await db.insert(creatorProfiles).values({ userId, ...profileValues });
  }

  const existingCategories = await listActiveCategoriesForUser(userId);
  if (existingCategories.length === 0) {
    await generateCategoriesForUser(userId);
  }

  const existingAngles = await listActiveAnglesForUser(userId);
  if (existingAngles.length === 0) {
    await generateAnglesForUser(userId);
  }

  const existingSeries = await listActiveSeriesForUser(userId);
  if (existingSeries.length === 0) {
    await generateSeriesForUser(userId); // dépend des catégories, générées juste au-dessus
  }

  const platforms = (extracted.suggestedPlatforms ?? []).filter(isKnownPlatform);
  for (const platform of platforms) {
    const existingGoal = await db.query.postingGoals.findFirst({
      where: and(eq(postingGoals.userId, userId), eq(postingGoals.platform, platform)),
    });
    if (!existingGoal) {
      await db.insert(postingGoals).values({ userId, platform, targetCountPerWeek: DEFAULT_WEEKLY_TARGET });
    }
  }
}

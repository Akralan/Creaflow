import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, products } from "@/db/schema";
import { suggestCategoryLabels, type CategoryLabels } from "@/lib/claude/categoryLabels";
import { ApiError } from "@/lib/api/errors";

export async function generateCategoryLabelsForUser(userId: string): Promise<CategoryLabels> {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur avant de générer les catégories.");
  }

  const productList = await db.query.products.findMany({ where: eq(products.userId, userId) });

  const labels = await suggestCategoryLabels({
    brandName: profile.brandName,
    activityType: profile.activityType,
    tone: profile.tone,
    values: profile.values,
    products: productList.map((p) => ({ name: p.name, description: p.description })),
  });

  await db.update(creatorProfiles).set({ categoryLabels: labels }).where(eq(creatorProfiles.userId, userId));
  return labels;
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { categoryLabelsSchema, normalizeCategoryWeights } from "@/lib/claude/categoryLabels";
import { generateCategoryLabelsForUser } from "@/lib/services/categoryLabelsService";
import { handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();

    const rawBody = await request.text();
    if (rawBody) {
      // Édition manuelle : on valide et on normalise les poids sans repasser par l'IA.
      const parsed = categoryLabelsSchema.parse(JSON.parse(rawBody));
      const labels = normalizeCategoryWeights(parsed);
      await db.update(creatorProfiles).set({ categoryLabels: labels }).where(eq(creatorProfiles.userId, userId));
      return NextResponse.json({ categoryLabels: labels });
    }

    const labels = await generateCategoryLabelsForUser(userId);
    return NextResponse.json({ categoryLabels: labels });
  } catch (error) {
    return handleApiError(error);
  }
}

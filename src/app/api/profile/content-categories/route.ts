import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import {
  generateCategoriesForUser,
  listActiveCategoriesForUser,
  saveCategoriesForUser,
} from "@/lib/services/categoryLabelsService";
import { platformSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const saveSchema = z.object({
  categories: z
    .array(
      z.object({
        id: z.uuid().optional(),
        label: z.string().min(1),
        description: z.string().min(1),
        weight: z.number().int().min(5).max(90),
        platforms: z.array(platformSchema).default([]),
        materialHungry: z.boolean().optional(),
      })
    )
    .min(2)
    .max(6),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const categories = await listActiveCategoriesForUser(userId);
    return NextResponse.json({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();

    const rawBody = await request.text();
    if (rawBody) {
      // Manual edit: we validate and normalise the weights without going through the AI again.
      const { categories: items } = saveSchema.parse(JSON.parse(rawBody));
      const categories = await saveCategoriesForUser(userId, items);
      return NextResponse.json({ categories });
    }

    // Full regeneration of the categories via AI (unlike the manual edit
    // above) — same order of magnitude as style-analysis for an action of this kind.
    await enforceRateLimit("content-categories-generate", userId, 5, 60);
    const categories = await generateCategoriesForUser(userId);
    return NextResponse.json({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

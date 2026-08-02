import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import {
  generateCategoriesForUser,
  listActiveCategoriesForUser,
  saveCategoriesForUser,
} from "@/lib/services/categoryLabelsService";
import { handleApiError } from "@/lib/api/errors";

const saveSchema = z.object({
  categories: z
    .array(
      z.object({
        id: z.uuid().optional(),
        label: z.string().min(1),
        description: z.string().min(1),
        weight: z.number().int().min(5).max(90),
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
      // Édition manuelle : on valide et on normalise les poids sans repasser par l'IA.
      const { categories: items } = saveSchema.parse(JSON.parse(rawBody));
      const categories = await saveCategoriesForUser(userId, items);
      return NextResponse.json({ categories });
    }

    const categories = await generateCategoriesForUser(userId);
    return NextResponse.json({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

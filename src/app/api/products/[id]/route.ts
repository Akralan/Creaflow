import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { MIN_PRODUCTS } from "@/lib/validation";
import { updateProductForUser } from "@/lib/services/productsService";
import { refreshStaleReaderPortraits } from "@/lib/services/readerPortraitService";
import { logger } from "@/lib/logger";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  valueProposition: z.string().optional(),
  photoUrl: z.string().optional(),
  // Audience override per topic, explicitly nullable so it can revert to the fallback
  // brand (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — the only field in this schema that accepts null,
  // the others stay "omitted = unchanged" for consistency with the rest of the product form.
  targetAudience: z.string().nullable().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = updateProductSchema.parse(await request.json());

    const updated = await updateProductForUser(userId, id, body);
    // A modified "Who is it for" makes the portrait stale (unless it was corrected by hand).
    if (body.targetAudience !== undefined) {
      after(() =>
        refreshStaleReaderPortraits(userId, [id]).catch((err) => logger.error("Reader portraits failed", err, { userId }))
      );
    }

    return NextResponse.json({ product: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(products)
      .where(eq(products.userId, userId));

    // We only block going below the threshold (3 -> 2), not the progressive build-up
    // of the catalogue below 3 during onboarding.
    if (existingCount === MIN_PRODUCTS) {
      throw new ApiError(
        400,
        `The catalogue must contain at least ${MIN_PRODUCTS} topics.`
      );
    }

    const [deleted] = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning({ id: products.id });

    if (!deleted) {
      throw new ApiError(404, "Topic not found.");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

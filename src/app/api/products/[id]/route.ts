import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  valueProposition: z.string().optional(),
  photoUrl: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = updateProductSchema.parse(await request.json());

    const [updated] = await db
      .update(products)
      .set(body)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning();

    if (!updated) {
      throw new ApiError(404, "Produit introuvable.");
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

    const [deleted] = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.userId, userId)))
      .returning({ id: products.id });

    if (!deleted) {
      throw new ApiError(404, "Produit introuvable.");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, count } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { MAX_PRODUCTS } from "@/lib/validation";

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  valueProposition: z.string().optional(),
  photoUrl: z.string().optional(),
});

const createProductsSchema = z.union([productSchema, z.array(productSchema).min(1)]);

export async function GET() {
  try {
    const userId = await requireUserId();
    const list = await db.query.products.findMany({ where: eq(products.userId, userId) });
    return NextResponse.json({ products: list });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const parsed = createProductsSchema.parse(await request.json());
    const items = Array.isArray(parsed) ? parsed : [parsed];

    const [{ value: existingCount }] = await db
      .select({ value: count() })
      .from(products)
      .where(eq(products.userId, userId));

    if (existingCount + items.length > MAX_PRODUCTS) {
      throw new ApiError(
        400,
        `Maximum ${MAX_PRODUCTS} produits par catalogue (${existingCount} déjà enregistrés).`
      );
    }

    const created = await db
      .insert(products)
      .values(items.map((item) => ({ userId, ...item })))
      .returning();

    return NextResponse.json({ products: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

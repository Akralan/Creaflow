import { and, count, eq } from "drizzle-orm";
import type { Phase } from "@/lib/phases";
import { db } from "@/db";
import { products } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { MAX_PRODUCTS } from "@/lib/validation";

interface ProductCreateInput {
  name: string;
  description?: string;
  valueProposition?: string;
  photoUrl?: string;
  /** Per-topic audience override (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — null/absent = fallback
   *  to CreatorProfile.targetAudience at injection. */
  targetAudience?: string | null;
}

interface ProductUpdateInput {
  name?: string;
  description?: string;
  valueProposition?: string;
  photoUrl?: string;
  targetAudience?: string | null;
  /** The problem the project solves (docs/SPEC_ENTREE_PAR_LE_REPO.md D14), nullable like the audience. */
  problem?: string | null;
  /** Où en est le projet (src/lib/phases.ts) : décide des formes de post permises. */
  phase?: Phase;
}

export async function createProductsForUser(userId: string, items: ProductCreateInput[]) {
  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(products)
    .where(eq(products.userId, userId));

  if (existingCount + items.length > MAX_PRODUCTS) {
    throw new ApiError(400, `Maximum ${MAX_PRODUCTS} topics per catalogue (${existingCount} already saved).`);
  }

  return db
    .insert(products)
    .values(items.map((item) => ({ userId, ...item })))
    .returning();
}

export async function updateProductForUser(userId: string, id: string, data: ProductUpdateInput) {
  const [updated] = await db
    .update(products)
    .set(data)
    .where(and(eq(products.id, id), eq(products.userId, userId)))
    .returning();

  if (!updated) {
    throw new ApiError(404, "Topic not found.");
  }

  return updated;
}

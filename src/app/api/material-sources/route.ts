import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { listSourcesForProduct } from "@/lib/services/githubSourceService";
import { handleApiError } from "@/lib/api/errors";

const listSchema = z.object({ productId: z.uuid() });

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId } = listSchema.parse({ productId: request.nextUrl.searchParams.get("productId") ?? undefined });
    return NextResponse.json({ sources: await listSourcesForProduct(userId, productId) });
  } catch (error) {
    return handleApiError(error);
  }
}

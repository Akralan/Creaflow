import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts, postMetrics } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";

const schema = z.object({
  views: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = schema.parse(await request.json());

    const script = await db.query.scripts.findFirst({
      where: and(eq(scripts.id, id), eq(scripts.userId, userId)),
    });
    if (!script) {
      throw new ApiError(404, "Script introuvable.");
    }

    const existing = await db.query.postMetrics.findFirst({ where: eq(postMetrics.scriptId, id) });

    const values = {
      views: body.views ?? existing?.views ?? 0,
      likes: body.likes ?? existing?.likes ?? 0,
      comments: body.comments ?? existing?.comments ?? 0,
      shares: body.shares ?? existing?.shares ?? 0,
      updatedAt: new Date(),
    };

    const [metrics] = existing
      ? await db.update(postMetrics).set(values).where(eq(postMetrics.id, existing.id)).returning()
      : await db.insert(postMetrics).values({ scriptId: id, ...values }).returning();

    return NextResponse.json({ metrics });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { postMatchCandidates, postMetrics, postMetricsSnapshots } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";

const schema = z.object({ action: z.enum(["confirm", "dismiss"]) });

const candidateMetricsSchema = z.object({
  views: z.number().int(),
  likes: z.number().int(),
  comments: z.number().int(),
  shares: z.number().int(),
});

/** Single user confirmation of the post↔script link (docs/SPEC_METRIQUES_AUTO.md §4) —
 *  "confirm" attaches definitively (the fetch pipeline then updates this post directly
 *  via platformPostId, without going through matching again), "dismiss" is just as final: this
 *  candidate is never proposed again. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { action } = schema.parse(await request.json());

    const candidate = await db.query.postMatchCandidates.findFirst({
      where: and(eq(postMatchCandidates.id, id), eq(postMatchCandidates.userId, userId)),
    });
    if (!candidate) {
      throw new ApiError(404, "Link candidate not found.");
    }
    if (candidate.status !== "pending") {
      throw new ApiError(400, "This candidate has already been handled.");
    }

    if (action === "dismiss") {
      await db
        .update(postMatchCandidates)
        .set({ status: "dismissed", resolvedAt: new Date() })
        .where(eq(postMatchCandidates.id, candidate.id));
      return NextResponse.json({ ok: true });
    }

    const metrics = candidateMetricsSchema.parse(candidate.metrics);

    await db.transaction(async (tx) => {
      const existing = await tx.query.postMetrics.findFirst({ where: eq(postMetrics.scriptId, candidate.scriptId) });
      const values = {
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        source: "api" as const,
        platformPostId: candidate.platformPostId,
        fetchedAt: new Date(),
        updatedAt: new Date(),
      };
      if (existing) {
        await tx.update(postMetrics).set(values).where(eq(postMetrics.id, existing.id));
      } else {
        await tx.insert(postMetrics).values({ scriptId: candidate.scriptId, ...values });
      }
      await tx.insert(postMetricsSnapshots).values({
        scriptId: candidate.scriptId,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        source: "api",
      });
      await tx
        .update(postMatchCandidates)
        .set({ status: "confirmed", resolvedAt: new Date() })
        .where(eq(postMatchCandidates.id, candidate.id));
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

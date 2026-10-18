import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { postMatchCandidates } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { LinkConflictError, linkPostToScript } from "@/lib/services/postLinkService";

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

    // The status change is the claim: `WHERE status = 'pending'` lets only one of two simultaneous requests
    // (a double click, two tabs) through.
    const claim = (status: "confirmed" | "dismissed") =>
      db
        .update(postMatchCandidates)
        .set({ status, resolvedAt: new Date() })
        .where(and(eq(postMatchCandidates.id, candidate.id), eq(postMatchCandidates.userId, userId), eq(postMatchCandidates.status, "pending")))
        .returning({ id: postMatchCandidates.id });

    if (action === "dismiss") {
      if ((await claim("dismissed")).length === 0) throw new ApiError(400, "This candidate has already been handled.");
      return NextResponse.json({ ok: true });
    }

    const metrics = candidateMetricsSchema.parse(candidate.metrics);

    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(postMatchCandidates)
        .set({ status: "confirmed", resolvedAt: new Date() })
        .where(and(eq(postMatchCandidates.id, candidate.id), eq(postMatchCandidates.userId, userId), eq(postMatchCandidates.status, "pending")))
        .returning({ id: postMatchCandidates.id });
      if (claimed.length === 0) throw new ApiError(400, "This candidate has already been handled.");
      await linkPostToScript(tx, {
        userId,
        scriptId: candidate.scriptId,
        platformPostId: candidate.platformPostId,
        publishedAt: candidate.publishedAt,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LinkConflictError) {
      return handleApiError(new ApiError(409, "That script is already linked to another post."));
    }
    return handleApiError(error);
  }
}

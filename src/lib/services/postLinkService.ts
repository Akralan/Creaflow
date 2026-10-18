import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, postMetrics, postMetricsSnapshots, scripts } from "@/db/schema";

/**
 * Links a script to the post that went out on a network (docs/SPEC_PERFORMANCE.md §4): from then on the
 * fetch updates that post's numbers directly. This is also the moment the script becomes « Posted » — the
 * only place that status is written (docs/SPEC_APP_DESIGN_TELLOVO.md E14), because it is a fact the network
 * reported, not something the author declares.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface LinkedPost {
  userId: string;
  scriptId: string;
  platformPostId: string;
  /** Real publication date as the network reports it; null keeps what is stored. */
  publishedAt: Date | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export class LinkConflictError extends Error {}

export async function linkPostToScript(tx: Tx, post: LinkedPost): Promise<void> {
  const now = new Date();
  const values = {
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    source: "api" as const,
    platformPostId: post.platformPostId,
    ...(post.publishedAt ? { publishedAt: post.publishedAt } : {}),
    fetchedAt: now,
    updatedAt: now,
  };

  const existing = await tx.query.postMetrics.findFirst({
    where: eq(postMetrics.scriptId, post.scriptId),
  });
  // A script stands for one post. Linking it to a second one would erase the numbers of the first.
  if (existing?.platformPostId && existing.platformPostId !== post.platformPostId) {
    throw new LinkConflictError("This script is already linked to another post.");
  }
  if (existing) await tx.update(postMetrics).set(values).where(eq(postMetrics.id, existing.id));
  else await tx.insert(postMetrics).values({ scriptId: post.scriptId, ...values });

  await tx.insert(postMetricsSnapshots).values({
    scriptId: post.scriptId,
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    source: "api",
  });

  // Scoped to the owner: the script id comes from a link candidate, never trusted on its own.
  await tx
    .update(scripts)
    .set({ status: "published", updatedAt: now })
    .where(and(eq(scripts.id, post.scriptId), eq(scripts.userId, post.userId)));
  await tx
    .update(calendarEntries)
    .set({ status: "published" })
    .where(and(eq(calendarEntries.scriptId, post.scriptId), eq(calendarEntries.userId, post.userId)));
}

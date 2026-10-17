import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { scripts } from "@/db/schema";
import { postCardFromScript, type RecentPostCard } from "@/lib/llm/recentPosts";

/** Posts re-read by the memory (docs/SPEC_MEMOIRE_ET_VEILLE.md §2). */
export const RECENT_POSTS_LIMIT = 5;

/** Cards of a topic's last posts, from most recent to oldest — [] outside a topic. */
export async function loadRecentPostCards(userId: string, productId: string | null, excludeScriptId: string | null): Promise<RecentPostCard[]> {
  if (!productId) return [];
  const rows = await db.query.scripts.findMany({
    where: and(eq(scripts.userId, userId), eq(scripts.productId, productId), excludeScriptId ? ne(scripts.id, excludeScriptId) : undefined),
    orderBy: desc(scripts.createdAt),
    limit: RECENT_POSTS_LIMIT,
    columns: { createdAt: true, platform: true, hookText: true, storyboard: true, caption: true, generationTrace: true },
  });
  return rows.map(postCardFromScript);
}

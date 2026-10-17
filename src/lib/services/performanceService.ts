import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts } from "@/db/schema";

/** Below this threshold of scripts with metrics entered on the platform, the signal is too
 *  noisy to be usable — we inject nothing into the prompt rather than generalise
 *  from 1-2 posts. */
const MIN_SAMPLES_FOR_SIGNAL = 3;

function engagementRate(m: { views: number; likes: number; comments: number; shares: number }): number {
  return (m.likes + m.comments + m.shares) / Math.max(m.views, 1);
}

/** Summarises what performs best recently on this platform, category by category,
 *  from the metrics entered manually by the user. No LLM call here:
 *  a simple deterministic calculation is enough and stays cheap. */
export async function buildPerformanceSummary(userId: string, platform: string): Promise<string | null> {
  const rows = await db.query.scripts.findMany({
    where: and(eq(scripts.userId, userId), eq(scripts.platform, platform)),
    with: {
      metrics: true,
      contentCategory: { columns: { label: true } },
    },
  });

  const withMetrics = rows.filter((r) => r.metrics);
  if (withMetrics.length < MIN_SAMPLES_FOR_SIGNAL) return null;

  const byCategory = new Map<string, { total: number; count: number }>();
  for (const r of withMetrics) {
    const rate = engagementRate(r.metrics!);
    const label = r.contentCategory.label;
    const entry = byCategory.get(label) ?? { total: 0, count: 0 };
    entry.total += rate;
    entry.count += 1;
    byCategory.set(label, entry);
  }

  // Comparing categories only makes sense if there are at least 2 with data.
  if (byCategory.size < 2) return null;

  const ranked = Array.from(byCategory.entries())
    .map(([label, { total, count }]) => ({ label, avg: total / count }))
    .sort((a, b) => b.avg - a.avg);

  const best = ranked[0];
  return `On ${platform}, content in the "${best.label}" category has the best recent engagement rate (views/likes/comments/shares entered by the user) — favour similar angles when relevant, without limiting yourself to them.`;
}

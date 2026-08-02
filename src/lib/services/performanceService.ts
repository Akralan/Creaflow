import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts } from "@/db/schema";

/** Sous ce seuil de scripts avec métriques saisies sur la plateforme, le signal est trop
 *  bruité pour être exploitable — on n'injecte rien dans le prompt plutôt que de généraliser
 *  sur 1-2 posts. */
const MIN_SAMPLES_FOR_SIGNAL = 3;

function engagementRate(m: { views: number; likes: number; comments: number; shares: number }): number {
  return (m.likes + m.comments + m.shares) / Math.max(m.views, 1);
}

/** Résume ce qui performe le mieux récemment sur cette plateforme, catégorie par catégorie,
 *  à partir des métriques saisies manuellement par l'utilisateur. Pas d'appel LLM ici :
 *  un calcul déterministe simple suffit et reste bon marché. */
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

  // Comparer les catégories n'a de sens que s'il y en a au moins 2 avec des données.
  if (byCategory.size < 2) return null;

  const ranked = Array.from(byCategory.entries())
    .map(([label, { total, count }]) => ({ label, avg: total / count }))
    .sort((a, b) => b.avg - a.avg);

  const best = ranked[0];
  return `Sur ${platform}, les contenus de catégorie "${best.label}" ont le meilleur taux d'engagement récent (vues/likes/commentaires/partages saisis par l'utilisateur) — privilégie des angles similaires quand c'est pertinent, sans t'y limiter.`;
}

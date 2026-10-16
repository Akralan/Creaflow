import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, contentSeries } from "@/db/schema";
import { listActiveSeriesForUser } from "@/lib/services/seriesService";
import { logger } from "@/lib/logger";

export interface ReplacementSeries {
  id: string;
  weight: number;
  categoryId: string;
  /** Vide = tous les réseaux. */
  platforms: string[];
}

/**
 * Créneaux vides d'une série retirée → séries restantes. Chaque créneau, dans l'ordre des dates,
 * va à la série compatible avec son réseau la moins servie au regard de son poids (comme le
 * calendrier répartit les créneaux). Sans série compatible : `null`, le créneau devient un post
 * libre et garde son rôle. Pur, pour être testé sans base.
 */
export function pickReplacementSeries(
  slots: Array<{ id: string; platform: string; date: Date }>,
  series: ReplacementSeries[]
): Map<string, ReplacementSeries | null> {
  const given = new Map<string, number>(series.map((s) => [s.id, 0]));
  const result = new Map<string, ReplacementSeries | null>();
  for (const slot of [...slots].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const compatible = series.filter((s) => s.weight > 0 && (s.platforms.length === 0 || s.platforms.includes(slot.platform)));
    const pick =
      compatible.reduce<ReplacementSeries | null>((best, s) => {
        if (!best) return s;
        // Moins servie relativement à son poids ; à égalité, la plus lourde.
        const ratio = (given.get(s.id) ?? 0) / s.weight;
        const bestRatio = (given.get(best.id) ?? 0) / best.weight;
        return ratio < bestRatio || (ratio === bestRatio && s.weight > best.weight) ? s : best;
      }, null) ?? null;
    if (pick) given.set(pick.id, (given.get(pick.id) ?? 0) + 1);
    result.set(slot.id, pick);
  }
  return result;
}

/**
 * Après le retrait (archivage) d'une ou plusieurs séries : leurs créneaux vides à venir passent aux
 * séries restantes. Sans ça, le calendrier proposait encore comme « post suivant » un épisode d'une
 * série supprimée. Les créneaux déjà rédigés et les créneaux passés ne bougent pas : c'est de
 * l'historique. Jamais bloquant pour l'appelant — journalisé en cas d'échec.
 */
export async function releaseSlotsOfArchivedSeries(userId: string): Promise<void> {
  try {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const archived = await db.query.contentSeries.findMany({
      where: and(eq(contentSeries.userId, userId), eq(contentSeries.archived, true)),
      columns: { id: true },
    });
    if (archived.length === 0) return;
    const orphans = await db.query.calendarEntries.findMany({
      where: and(
        eq(calendarEntries.userId, userId),
        isNull(calendarEntries.scriptId),
        gte(calendarEntries.scheduledDate, today),
        inArray(
          calendarEntries.seriesId,
          archived.map((s) => s.id)
        )
      ),
      columns: { id: true, platform: true, scheduledDate: true },
    });
    if (orphans.length === 0) return;

    const active = (await listActiveSeriesForUser(userId))
      .filter((s): s is typeof s & { category: { id: string; label: string } } => s.category !== null)
      .map((s) => ({ id: s.id, weight: s.weight, categoryId: s.category.id, platforms: s.platforms }));
    const picks = pickReplacementSeries(
      orphans.map((o) => ({ id: o.id, platform: o.platform, date: o.scheduledDate })),
      active
    );

    for (const orphan of orphans) {
      const pick = picks.get(orphan.id) ?? null;
      await db
        .update(calendarEntries)
        .set(pick ? { seriesId: pick.id, contentCategoryId: pick.categoryId } : { seriesId: null })
        .where(eq(calendarEntries.id, orphan.id));
    }
  } catch (error) {
    logger.error("Réaffectation des créneaux d'une série retirée impossible", error, { userId });
  }
}

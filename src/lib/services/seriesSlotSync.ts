import { and, eq, gt, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, contentSeries, postingGoals } from "@/db/schema";
import { planSeriesSlots, slotKey } from "@/lib/services/calendarService";
import { parseStoredRhythm, RHYTHM_HORIZON_DAYS, toIsoDate } from "@/lib/seriesRhythm";
import { logger } from "@/lib/logger";

/** Ce qu'un recalcul a changé pour une série : affiché après l'enregistrement d'une série (§4). */
export interface SeriesSlotChange {
  created: number;
  removed: number;
  /** Dernier jour de l'horizon (YYYY-MM-DD) : « d'ici le … ». */
  until: string;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Verrou du calendrier d'un utilisateur, jusqu'à la fin de la transaction : un recalcul et un saut
 *  de jour ne s'entrecroisent jamais. */
async function lockCalendar(tx: Tx, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`calendar-sync:${userId}`}))`);
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Tient le calendrier à jour à partir des rythmes (docs/SPEC_RYTHME_DES_SERIES.md §3), sur les
 * 28 jours qui viennent : crée les créneaux manquants de chaque série active, retire ses créneaux
 * vides qui ne tombent plus sur son rythme ou sur un réseau actif, et sort du calendrier les
 * créneaux à venir non publiés des séries retirées (leurs scripts restent dans les scripts).
 * Jamais un créneau passé, publié ou déjà rédigé d'une série active ne bouge.
 *
 * Appelé après toute écriture qui change un rythme, une série ou un réseau, et à la lecture du
 * calendrier (l'horizon avance avec les jours, pas de cron). Un verrou par utilisateur évite que
 * deux lectures simultanées créent deux fois le même créneau. Jamais bloquant pour l'appelant :
 * journalisé en cas d'échec.
 */
export async function syncSeriesSlots(userId: string): Promise<Map<string, SeriesSlotChange>> {
  const changes = new Map<string, SeriesSlotChange>();
  try {
    const from = todayUtc();
    const to = new Date(from.getTime() + (RHYTHM_HORIZON_DAYS - 1) * 86_400_000);
    await db.transaction(async (tx) => {
      await lockCalendar(tx, userId);

      // L'une après l'autre : pas deux requêtes à la fois sur le client d'une transaction.
      const series = await tx.query.contentSeries.findMany({
        where: eq(contentSeries.userId, userId),
        columns: { id: true, archived: true, rhythm: true, skippedSlots: true },
        with: {
          contentSeriesCategories: { columns: { categoryId: true }, limit: 1 },
          contentSeriesPlatforms: { columns: { platform: true } },
        },
      });
      const goals = await tx.query.postingGoals.findMany({ where: and(eq(postingGoals.userId, userId), gt(postingGoals.targetCountPerWeek, 0)) });

      // Séries retirées : tout ce qui n'est pas encore publié quitte le calendrier à venir.
      const archivedIds = series.filter((s) => s.archived).map((s) => s.id);
      if (archivedIds.length > 0) {
        await tx
          .delete(calendarEntries)
          .where(
            and(
              eq(calendarEntries.userId, userId),
              inArray(calendarEntries.seriesId, archivedIds),
              gte(calendarEntries.scheduledDate, from),
              ne(calendarEntries.status, "published")
            )
          );
      }

      const active = series.filter((s) => !s.archived && s.contentSeriesCategories[0]);
      if (active.length === 0) return;
      const existing = await tx.query.calendarEntries.findMany({
        where: and(
          eq(calendarEntries.userId, userId),
          inArray(
            calendarEntries.seriesId,
            active.map((s) => s.id)
          ),
          gte(calendarEntries.scheduledDate, from)
        ),
        columns: { id: true, seriesId: true, platform: true, scheduledDate: true, scriptId: true, status: true },
      });
      const activePlatforms = goals.map((g) => g.platform);

      for (const s of active) {
        const { toCreate, toDelete } = planSeriesSlots({
          series: {
            id: s.id,
            rhythm: parseStoredRhythm(s.rhythm),
            platforms: s.contentSeriesPlatforms.map((p) => p.platform),
            skippedSlots: s.skippedSlots,
          },
          activePlatforms,
          existing: existing.map((e) => ({
            id: e.id,
            seriesId: e.seriesId as string,
            platform: e.platform,
            scheduledDate: e.scheduledDate,
            locked: e.scriptId !== null || e.status === "published",
          })),
          from,
          to,
        });
        if (toDelete.length > 0) await tx.delete(calendarEntries).where(inArray(calendarEntries.id, toDelete));
        if (toCreate.length > 0) {
          const categoryId = s.contentSeriesCategories[0].categoryId;
          await tx
            .insert(calendarEntries)
            .values(toCreate.map((c) => ({ userId, seriesId: s.id, contentCategoryId: categoryId, platform: c.platform, scheduledDate: c.scheduledDate })));
        }
        changes.set(s.id, { created: toCreate.length, removed: toDelete.length, until: toIsoDate(to) });
      }
    });
  } catch (error) {
    logger.error("Mise à jour du calendrier depuis les rythmes impossible", error, { userId });
  }
  return changes;
}

/**
 * Retire un créneau vide d'une série du calendrier : il est noté dans ses créneaux sautés pour que
 * le recalcul ne le recrée pas. Les dates passées sont élaguées au passage.
 */
export async function skipSeriesSlot(userId: string, entry: { id: string; seriesId: string; platform: string; scheduledDate: Date }) {
  const today = toIsoDate(todayUtc());
  await db.transaction(async (tx) => {
    // Sous le même verrou que le recalcul, et la liste relue dans la transaction : un recalcul
    // concurrent ne recrée pas le jour, deux sauts simultanés ne s'écrasent pas.
    await lockCalendar(tx, userId);
    const series = await tx.query.contentSeries.findFirst({
      where: and(eq(contentSeries.id, entry.seriesId), eq(contentSeries.userId, userId)),
      columns: { skippedSlots: true },
    });
    const kept = (series?.skippedSlots ?? []).filter((key) => key.slice(0, 10) >= today);
    await tx
      .update(contentSeries)
      .set({ skippedSlots: [...new Set([...kept, slotKey(entry.scheduledDate, entry.platform)])] })
      .where(and(eq(contentSeries.id, entry.seriesId), eq(contentSeries.userId, userId)));
    await tx.delete(calendarEntries).where(and(eq(calendarEntries.id, entry.id), eq(calendarEntries.userId, userId)));
  });
}

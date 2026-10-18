import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { entriesOfPost } from "@/lib/services/postPairService";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

/**
 * Demandes d'écriture faites depuis l'écran « Your content week » (docs/SPEC_APP_DESIGN_TELLOVO.md E11) :
 * on marque les créneaux « en chargement » et on rend la main ; l'écriture elle-même se fait en fond
 * (`generateOtherPosts`), un post après l'autre, les deux réseaux de chacun.
 */

const DAY_MS = 24 * 3600 * 1000;

/** Marque « en chargement » tous les créneaux sans script d'un post. */
async function markGenerating(userId: string, entry: typeof calendarEntries.$inferSelect): Promise<number> {
  let marked = 0;
  for (const version of await entriesOfPost(userId, entry)) {
    if (version.scriptId) continue;
    await db.update(calendarEntries).set({ status: "generating", generatingSince: new Date() }).where(and(eq(calendarEntries.id, version.id), isNull(calendarEntries.scriptId)));
    marked += 1;
  }
  return marked;
}

/** Écrit un post : ses deux réseaux, à partir d'un de ses créneaux vides. */
export async function requestPostWrite(userId: string, entryId: string): Promise<void> {
  const entry = await db.query.calendarEntries.findFirst({ where: and(eq(calendarEntries.id, entryId), eq(calendarEntries.userId, userId)) });
  if (!entry) throw new ApiError(404, "Calendar slot not found.");
  const versions = await entriesOfPost(userId, entry);
  if (versions.every((v) => v.scriptId)) throw new ApiError(409, "This post is already written.");
  await enforceScriptQuota(userId, { date: entry.scheduledDate });
  await markGenerating(userId, entry);
}

/** Prépare une semaine : tous ses créneaux vides, pour les deux réseaux. Rend le nombre de posts lancés. */
export async function requestWeekPreparation(userId: string, weekStart: Date): Promise<number> {
  const end = new Date(weekStart.getTime() + 7 * DAY_MS);
  const slots = await db.query.calendarEntries.findMany({
    where: and(eq(calendarEntries.userId, userId), isNull(calendarEntries.scriptId), gte(calendarEntries.scheduledDate, weekStart), lt(calendarEntries.scheduledDate, end)),
    orderBy: asc(calendarEntries.scheduledDate),
  });
  const known = new Set(KNOWN_PLATFORMS.map((p) => p.key));
  const open = slots.filter((s) => known.has(s.platform));
  if (open.length === 0) throw new ApiError(409, "Nothing to write for this week: no post is planned. Give a series publishing days in Direction.");
  await enforceScriptQuota(userId, { date: weekStart });
  const seen = new Set<string>();
  let posts = 0;
  for (const slot of open) {
    const key = `${slot.seriesId}|${slot.scheduledDate.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if ((await markGenerating(userId, slot)) > 0) posts += 1;
  }
  return posts;
}

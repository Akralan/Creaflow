import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, creatorProfiles, postingGoals, visualDesigns } from "@/db/schema";
import { planForSeries } from "@/lib/services/seriesReaderService";
import { imagesOf, slidesOf } from "@/lib/services/visualDesignService";
import { syncSeriesSlots } from "@/lib/services/seriesSlotSync";
import { releaseStaleGenerating } from "@/lib/services/startRecovery";
import { isKnownPlatform } from "@/lib/social/types";

/** Posts rédigés montrés après la semaine affichée. */
const LATER_HORIZON_DAYS = 28;

/** Horizon des créneaux vides regardés pour attribuer les épisodes prévus et trouver le suivant. */
const UPCOMING_LOOKAHEAD = 120;

/** Ce qu'un créneau vide va devenir : le prochain événement de la ligne de temps vu par sa série
 *  (null si plus rien à raconter) et le projet auquel la série est reliée. */
export interface UpcomingPost {
  title: string | null;
  project: string | null;
}

/**
 * Épisodes prévus → créneaux vides : pour chaque série, ses créneaux vides à venir, dans l'ordre des
 * dates, reçoivent ses épisodes `planned`, dans l'ordre du plan. Pur, pour être testé sans base.
 */
export function assignPlannedBeats(
  slots: Array<{ id: string; seriesId: string | null; date: Date }>,
  plannedTitlesBySeries: Map<string, string[]>
): Map<string, string> {
  const result = new Map<string, string>();
  const cursor = new Map<string, number>();
  for (const slot of [...slots].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    if (!slot.seriesId) continue;
    const titles = plannedTitlesBySeries.get(slot.seriesId) ?? [];
    const i = cursor.get(slot.seriesId) ?? 0;
    if (i < titles.length) result.set(slot.id, titles[i]);
    cursor.set(slot.seriesId, i + 1);
  }
  return result;
}

async function loadUpcoming(userId: string, today: Date) {
  const slots = await     db.query.calendarEntries.findMany({
      where: and(eq(calendarEntries.userId, userId), isNull(calendarEntries.scriptId), gte(calendarEntries.scheduledDate, today)),
      with: {
        contentCategory: { columns: { id: true, label: true } },
        series: { columns: { id: true, label: true }, with: { product: { columns: { name: true } } } },
      },
      orderBy: (e, { asc }) => [asc(e.scheduledDate)],
      limit: UPCOMING_LOOKAHEAD,
    });
  // Les épisodes à venir de chaque série : sa ligne de temps, sans ce qui est déjà raconté.
  const planned = new Map<string, string[]>();
  for (const seriesId of new Set(slots.map((sl) => sl.seriesId).filter((id): id is string => id !== null))) {
    const plan = await planForSeries(userId, seriesId).catch(() => null);
    planned.set(seriesId, (plan?.events ?? []).filter((e) => !e.told).map((e) => e.title));
  }
  const titles = assignPlannedBeats(
    slots.map((sl) => ({ id: sl.id, seriesId: sl.seriesId, date: sl.scheduledDate })),
    planned
  );
  const upcoming = new Map<string, UpcomingPost>(
    slots.map((sl) => [sl.id, { title: titles.get(sl.id) ?? null, project: sl.series?.product?.name ?? null }])
  );
  return { slots, upcoming };
}

/** Extrait du texte du post affiché sur la carte : de quoi reconnaître le post, pas le relire. */
const CAPTION_PREVIEW_CHARS = 280;

/**
 * Créneaux d'une période (la semaine affichée par le calendrier), enrichis de ce qu'il faut pour
 * montrer le post lui-même et pas une case : accroche, début du texte, et pour un visuel la
 * première slide de sa maquette (HTML aux placeholders non résolus — l'écran les résout comme
 * l'éditeur, via les routes d'images du script).
 */
export async function listCalendarRange(userId: string, from: Date, to: Date) {
  // L'horizon de 28 jours avance avec les jours : on le complète à chaque ouverture (pas de cron).
  await releaseStaleGenerating(userId);
  await syncSeriesSlots(userId);

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { slots, upcoming } = await loadUpcoming(userId, today);
  // « Post suivant » : le premier créneau vide à venir après la semaine affichée (ou après
  // aujourd'hui pour une semaine passée).
  const next = slots.find((sl) => sl.scheduledDate >= to) ?? null;
  // Et celui de CHAQUE série : avec une ligne par série, chacune montre au moins son prochain post,
  // même au-delà de la semaine (docs/SPEC_RYTHME_DES_SERIES.md §4).
  // Borné à la fenêtre lue plus bas : sur une semaine passée, un « prochain » plus loin que la fenêtre
  // ne serait pas dans `entries` et la ligne se croirait vide.
  const until = new Date(to.getTime() + LATER_HORIZON_DAYS * 24 * 3600 * 1000);
  const nextBySeries = new Set<string>();
  const seenSeries = new Set<string>();
  for (const sl of slots) {
    if (sl.scheduledDate < to || sl.scheduledDate >= until || !sl.seriesId || seenSeries.has(sl.seriesId)) continue;
    seenSeries.add(sl.seriesId);
    nextBySeries.add(sl.id);
  }
  // La bande se prolonge : tous les posts déjà rédigés des quatre semaines qui suivent restent
  // visibles, le « post suivant » se rangeant parmi eux à sa date. (S'arrêter au prochain créneau
  // vide cachait un post rédigé plus loin, qui « apparaissait » dès que le trou était comblé.)
  const [entries, goals, profile] = await Promise.all([
    db.query.calendarEntries.findMany({
      where: and(
        eq(calendarEntries.userId, userId),
        gte(calendarEntries.scheduledDate, from),
        lt(calendarEntries.scheduledDate, until)
      ),
      with: {
        script: {
          columns: {
            id: true,
            title: true,
            status: true,
            contentType: true,
            visualFormat: true,
            slideCount: true,
            durationMs: true,
            hookText: true,
            caption: true,
          },
        },
        contentCategory: { columns: { id: true, label: true } },
        series: { columns: { id: true, label: true } },
      },
      orderBy: (e, { asc }) => [asc(e.scheduledDate)],
    }),
    db.query.postingGoals.findMany({ where: eq(postingGoals.userId, userId) }),
    db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { brandName: true, brandKit: true } }),
  ]);

  const visualIds = entries.filter((e) => e.script?.contentType === "visual").map((e) => e.script!.id);
  const designs = visualIds.length
    ? await db.query.visualDesigns.findMany({ where: and(eq(visualDesigns.userId, userId), inArray(visualDesigns.scriptId, visualIds)) })
    : [];
  const designByScript = new Map(designs.map((d) => [d.scriptId, d]));
  const hasLogo = Boolean((profile?.brandKit as { logoAssetId?: string | null } | null)?.logoAssetId);

  return {
    goals,
    authorName: profile?.brandName ?? "",
    hasLogo,
    nextSlot: next
      ? { ...next, series: next.series ? { id: next.series.id, label: next.series.label } : null, script: null, upcoming: upcoming.get(next.id) ?? null }
      : null,
    // Au-delà de la semaine, les posts rédigés et le prochain créneau vide de chaque série.
    entries: entries.filter((entry) => isKnownPlatform(entry.platform)).filter((entry) => entry.scheduledDate < to || entry.script || entry.status === "generating" || nextBySeries.has(entry.id)).map((entry) => {
      const script = entry.script;
      if (!script) return { ...entry, script: null, upcoming: upcoming.get(entry.id) ?? null };
      const design = designByScript.get(script.id);
      const slides = design ? slidesOf(design) : [];
      return {
        ...entry,
        script: {
          ...script,
          caption: script.caption ? script.caption.slice(0, CAPTION_PREVIEW_CHARS) : null,
          preview:
            design && slides[0]
              ? {
                  html: slides[0].html,
                  width: design.width,
                  height: design.height,
                  slideCount: slides.length,
                  images: imagesOf(design).map(({ ref, assetId, variant }) => ({ ref, assetId, variant })),
                }
              : null,
        },
      };
    }),
  };
}

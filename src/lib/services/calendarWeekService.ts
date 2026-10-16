import { and, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, creatorProfiles, narrativeState, postingGoals, visualDesigns } from "@/db/schema";
import { imagesOf, slidesOf } from "@/lib/services/visualDesignService";

/** Horizon des créneaux vides regardés pour attribuer les épisodes prévus et trouver le suivant. */
const UPCOMING_LOOKAHEAD = 120;

/** Ce qu'un créneau vide va devenir : l'épisode prévu par le plan de sa série (null hors
 *  feuilleton ou plan épuisé) et le projet auquel la série est reliée. */
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
  const [slots, states] = await Promise.all([
    db.query.calendarEntries.findMany({
      where: and(eq(calendarEntries.userId, userId), isNull(calendarEntries.scriptId), gte(calendarEntries.scheduledDate, today)),
      with: {
        contentCategory: { columns: { id: true, label: true } },
        series: { columns: { id: true, label: true }, with: { product: { columns: { name: true } } } },
      },
      orderBy: (e, { asc }) => [asc(e.scheduledDate)],
      limit: UPCOMING_LOOKAHEAD,
    }),
    db.query.narrativeState.findMany({ where: and(eq(narrativeState.userId, userId), isNotNull(narrativeState.seriesId)) }),
  ]);
  const planned = new Map(
    states.map((st) => [
      st.seriesId as string,
      ((st.beats as Array<{ title: string; status: string }> | null) ?? []).filter((b) => b.status === "planned").map((b) => b.title),
    ])
  );
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
  const [entries, goals, profile] = await Promise.all([
    db.query.calendarEntries.findMany({
      where: and(eq(calendarEntries.userId, userId), gte(calendarEntries.scheduledDate, from), lt(calendarEntries.scheduledDate, to)),
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

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { slots, upcoming } = await loadUpcoming(userId, today);
  const shownIds = new Set(entries.map((e) => e.id));
  // « Post suivant » : le premier créneau vide à venir qui n'est pas déjà sur la bande affichée.
  const next = slots.find((sl) => !shownIds.has(sl.id)) ?? null;
  // Sans aucun créneau vide à venir, c'est le mois en cours qu'on tente d'abord (l'écran passe au
  // suivant s'il est déjà planifié) ; sinon le mois qui suit le dernier créneau vide.
  const lastPlanned = slots.at(-1)?.scheduledDate;
  const afterLast = lastPlanned
    ? new Date(Date.UTC(lastPlanned.getUTCFullYear(), lastPlanned.getUTCMonth() + 1, 1))
    : today;

  return {
    goals,
    authorName: profile?.brandName ?? "",
    hasLogo,
    nextSlot: next
      ? { ...next, series: next.series ? { id: next.series.id, label: next.series.label } : null, script: null, upcoming: upcoming.get(next.id) ?? null }
      : null,
    // Plus aucun créneau vide à venir : le mois à planifier pour trouver la suite.
    monthToPlan: next ? null : `${afterLast.getUTCFullYear()}-${String(afterLast.getUTCMonth() + 1).padStart(2, "0")}`,
    entries: entries.map((entry) => {
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

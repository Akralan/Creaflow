import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, creatorProfiles, postingGoals, visualDesigns } from "@/db/schema";

import { imagesOf, slidesOf } from "@/lib/services/visualDesignService";
import { syncSeriesSlots } from "@/lib/services/seriesSlotSync";
import { releaseStaleGenerating } from "@/lib/services/startRecovery";
import { isKnownPlatform } from "@/lib/social/types";

/** Posts rédigés montrés après la semaine affichée. */
const LATER_HORIZON_DAYS = 28;

/** Horizon des créneaux vides regardés pour attribuer les épisodes prévus et trouver le suivant. */
const UPCOMING_LOOKAHEAD = 120;

/** Ce qu'un créneau vide montre : le projet auquel sa série est reliée. `title` reste dans la forme
 *  pour les écrans, mais toujours null depuis que le rédacteur choisit lui-même ses pointeurs
 *  (docs/SPEC_EVENEMENT_POINTEUR.md §4) — annoncer un titre serait annoncer un post qui ne
 *  sera pas écrit. */
export interface UpcomingPost {
  title: string | null;
  project: string | null;
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
  // RETIRÉ avec le choix côté code (docs/SPEC_EVENEMENT_POINTEUR.md §4) : le calendrier annonçait
  // le titre des prochains posts en prenant les événements non racontés dans l'ordre des dates.
  // C'est le rédacteur qui choisit maintenant, et il ne choisit pas dans l'ordre — ces titres
  // annonçaient des posts qui ne seront pas écrits. Un créneau vide n'annonce plus rien.
  const upcoming = new Map<string, UpcomingPost>(
    slots.map((sl) => [sl.id, { title: null, project: sl.series?.product?.name ?? null }])
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
export async function listCalendarRange(userId: string, from: Date, to: Date, options?: { allSlots?: boolean }) {
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
            form: true,
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
    entries: entries.filter((entry) => isKnownPlatform(entry.platform)).filter((entry) => options?.allSlots || entry.scheduledDate < to || entry.script || entry.status === "generating" || nextBySeries.has(entry.id)).map((entry) => {
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

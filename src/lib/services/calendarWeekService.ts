import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, creatorProfiles, postingGoals, visualDesigns } from "@/db/schema";
import { imagesOf, slidesOf } from "@/lib/services/visualDesignService";

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

  return {
    goals,
    authorName: profile?.brandName ?? "",
    hasLogo,
    entries: entries.map((entry) => {
      const script = entry.script;
      if (!script) return { ...entry, script: null };
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

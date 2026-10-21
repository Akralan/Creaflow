import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, contentSeries, materialEvents, scripts, sourceMaterials } from "@/db/schema";
import { readersOfProduct } from "@/lib/services/seriesReaderService";

import { decideNarrative, firstSeriesOfSubject, type NarrativeKind, type PlacementEvent, type PlacementPost } from "@/lib/narrative/placement";
import type { NarrativeBrief } from "@/lib/llm/narrativeWriter";
import type { BriefEvent } from "@/lib/llm/eventWriter";
import { toIsoDate } from "@/lib/seriesRhythm";
import { logger } from "@/lib/logger";

/**
 * Le fil narratif d'une série (docs/SPEC_FIL_NARRATIF.md §7 et §9) : décide si le prochain post est
 * un post de récit, et prépare son brief. Consulté AVANT le brief d'événement ; s'il rend null — le
 * cas de loin le plus fréquent — le chemin par événements ne change pas d'un iota.
 *
 * Le rang se compte toujours sans le créneau qu'on est en train d'écrire : c'est ce qui fait que les
 * deux réseaux d'un même post, et une régénération plus tard, retombent sur la même décision.
 */

export interface NarrativePlan {
  brief: NarrativeBrief;
  /** L'événement que ce post marque comme raconté — null sauf pour l'origine et la promesse tenue. */
  marksTold: string | null;
  /** Le post qui avait fait la promesse — null hors promesse tenue. */
  promiseSourceScriptId: string | null;
}

function toBriefEvent(e: typeof materialEvents.$inferSelect): BriefEvent {
  return {
    id: e.id,
    date: e.date,
    datePrecision: e.datePrecision,
    title: e.title,
    whatHappened: e.whatHappened,
    whatChanged: e.whatChanged,
    kind: e.kind,
  };
}

function toPlacementEvent(e: typeof materialEvents.$inferSelect): PlacementEvent {
  return { id: e.id, date: e.date, kind: e.kind, whatChanged: e.whatChanged };
}

/** Le texte d'un post, tel qu'un autre post pourra le citer. */
function postText(s: { title: string | null; hookText: string | null; hookVisual: string | null; caption: string | null }): string {
  return [s.title, s.hookText, s.hookVisual, s.caption].filter(Boolean).join("\n");
}

const promiseMatchShape = (raw: unknown): { promise: string; eventId: string } | null => {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as { promise?: unknown; eventId?: unknown };
  return typeof m.promise === "string" && typeof m.eventId === "string" ? { promise: m.promise, eventId: m.eventId } : null;
};

/**
 * Les posts déjà écrits de la série, **sans le créneau qu'on est en train d'écrire**. C'est cette
 * exclusion qui fait que les deux réseaux d'un même post — et une régénération plus tard — comptent
 * le même rang et retombent donc sur la même décision, sans qu'il faille verrouiller quoi que ce soit.
 */
export function writtenPostsForPlacement(
  slots: Array<{ scriptId: string | null; scheduledDate: Date }>,
  scriptsById: Map<string, { eventId: string | null; narrativeKind: NarrativeKind | null }>,
  excludeIso: string
): PlacementPost[] {
  return slots
    .map((s) => ({ date: toIsoDate(s.scheduledDate), script: s.scriptId ? scriptsById.get(s.scriptId) : undefined }))
    .filter((w): w is { date: string; script: { eventId: string | null; narrativeKind: NarrativeKind | null } } => Boolean(w.script) && w.date !== excludeIso)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({ date: w.date, narrativeKind: w.script.narrativeKind, eventId: w.script.eventId }));
}

export async function planNarrativePost(userId: string, seriesId: string, slotDate: Date): Promise<NarrativePlan | null> {
  const series = await db.query.contentSeries.findFirst({
    where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)),
    with: { product: true },
  });
  // Mêmes gardes que le brief d'événement : sans sujet ni lecteur, pas de récit.
  if (!series?.productId || !series.readerLabel) return null;
  const reader = readersOfProduct(series.product).find((r) => r.label === series.readerLabel);
  if (!reader) return null;

  const productId = series.productId;
  const slotIso = toIsoDate(slotDate);

  const [events, seriesScripts, allSlots, siblings, userScripts] = await Promise.all([
    db.query.materialEvents.findMany({
      where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, productId)),
      orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
    }),
    db.query.scripts.findMany({
      where: and(eq(scripts.userId, userId), eq(scripts.seriesId, seriesId)),
      columns: { id: true, eventId: true, narrativeKind: true, promiseHonored: true },
    }),
    // Tous les créneaux écrits de l'auteur, pas seulement ceux de cette série : il faut savoir
    // laquelle des séries du sujet a commencé à publier la première (§7).
    db.query.calendarEntries.findMany({
      where: and(eq(calendarEntries.userId, userId), isNotNull(calendarEntries.scriptId)),
      columns: { scriptId: true, scheduledDate: true, seriesId: true },
    }),
    db.query.contentSeries.findMany({ where: and(eq(contentSeries.userId, userId), eq(contentSeries.productId, productId)), columns: { id: true, archived: true, createdAt: true, rhythm: true } }),
    db.query.scripts.findMany({
      where: and(eq(scripts.userId, userId), eq(scripts.productId, productId)),
      columns: { id: true, title: true, hookText: true, hookVisual: true, caption: true, promiseMatch: true, promiseHonored: true, createdAt: true },
    }),
  ]);

  const slots = allSlots.filter((s) => s.seriesId === seriesId);
  const scriptById = new Map(seriesScripts.map((s) => [s.id, s]));
  const dateOfScript = new Map(slots.map((s) => [s.scriptId as string, toIsoDate(s.scheduledDate)]));
  // Le créneau qu'on écrit ne compte pas : sinon la version LinkedIn décalerait le rang de la version X.
  const onThisSlot = new Set([...dateOfScript.entries()].filter(([, d]) => d === slotIso).map(([id]) => id));

  const placementScripts = new Map(
    [...scriptById.entries()].map(([id, s]) => [id, { eventId: s.eventId, narrativeKind: s.narrativeKind as NarrativeKind | null }])
  );
  const written = writtenPostsForPlacement(slots, placementScripts, slotIso);

  // Le premier post écrit de chaque série du sujet : c'est ce qui départage les séries nées d'un
  // bloc en fin d'onboarding, toutes créées à la même microseconde.
  const firstPostBySeries = new Map<string, string>();
  for (const s of allSlots) {
    if (!s.scriptId || !s.seriesId) continue;
    const day = toIsoDate(s.scheduledDate);
    const seen = firstPostBySeries.get(s.seriesId);
    if (!seen || day < seen) firstPostBySeries.set(s.seriesId, day);
  }
  const firstSeriesId = firstSeriesOfSubject(
    siblings.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.getTime(),
      hasRhythm: s.rhythm !== null,
      archived: s.archived,
      firstPostDate: firstPostBySeries.get(s.id) ?? null,
    }))
  );

  // Une promesse déjà tenue par un AUTRE post ne se retient plus ; tenue par ce créneau-ci, si :
  // c'est ainsi que la version X retrouve la promesse que la version LinkedIn vient d'honorer.
  const honoredElsewhere = new Set(userScripts.filter((s) => s.promiseHonored && !onThisSlot.has(s.id)).map((s) => s.promiseHonored as string));
  const toldElsewhere = new Set(seriesScripts.filter((s) => s.eventId && !onThisSlot.has(s.id)).map((s) => s.eventId as string));

  const candidate = userScripts
    .map((s) => ({ script: s, match: promiseMatchShape(s.promiseMatch) }))
    .filter((c) => c.match && !honoredElsewhere.has(c.match.promise) && !toldElsewhere.has(c.match.eventId) && events.some((e) => e.id === c.match!.eventId))
    .sort((a, b) => a.script.createdAt.getTime() - b.script.createdAt.getTime())[0];

  const decision = decideNarrative({
    written,
    events: events.map(toPlacementEvent),
    isFirstSeries: firstSeriesId === seriesId,
    promiseMatch: candidate ? { promise: candidate.match!.promise, sourceScriptId: candidate.script.id, eventId: candidate.match!.eventId } : null,
  });
  if (!decision) return null;

  const byId = new Map(events.map((e) => [e.id, e]));
  const scope = decision.eventIds.map((id) => byId.get(id)).filter((e): e is typeof materialEvents.$inferSelect => Boolean(e));
  if (scope.length === 0) return null;

  const sourceIds = [...new Set(scope.map((e) => e.sourceMaterialId).filter((id): id is string => Boolean(id)))];
  const sources = sourceIds.length
    ? await db.query.sourceMaterials.findMany({ where: and(eq(sourceMaterials.userId, userId), sql`${sourceMaterials.id} in ${sourceIds}`), columns: { id: true, title: true, rawText: true } })
    : [];

  const promiseSource = decision.promise ? userScripts.find((s) => s.id === decision.promise?.sourceScriptId) : undefined;
  if (decision.kind === "promise" && !promiseSource) {
    logger.warn("Promise post dropped: its source post is gone", { userId, seriesId });
    return null;
  }

  return {
    brief: {
      kind: decision.kind,
      scope: scope.map(toBriefEvent),
      subject: {
        name: series.product?.name ?? series.label,
        description: series.product?.description ?? null,
        problem: series.product?.problem ?? null,
        valueProposition: series.product?.valueProposition ?? null,
        targetAudience: series.product?.targetAudience ?? null,
      },
      promise: decision.promise && promiseSource ? { text: decision.promise.text, postText: postText(promiseSource) } : null,
      reader,
      seriesLabel: series.label,
      sources: sources.map((s) => ({ id: s.id, title: s.title, text: s.rawText })),
    },
    marksTold: decision.marksTold,
    promiseSourceScriptId: decision.promise?.sourceScriptId ?? null,
  };
}

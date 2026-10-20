import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, creatorProfiles, materialEvents, products, scripts, sourceMaterials } from "@/db/schema";
import { describeSeriesForm, parseStoredSeriesForm, seriesFormSchema, type SeriesForm } from "@/lib/llm/seriesForm";
import type { BriefEvent, EventBrief } from "@/lib/llm/eventWriter";
import { parseStoredReaderPortrait, type Reader } from "@/lib/llm/readerPortrait";
import { angleFor, tellableTo } from "@/lib/narrative/audience";
import { listActiveSeriesForUser } from "@/lib/services/seriesService";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

/**
 * Le lecteur et la forme d'une série (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4), et le plan qui en
 * découle : la ligne de temps du sujet filtrée sur ce lecteur, dans l'ordre des dates, en sautant ce
 * qui a déjà été raconté. Remplace le plan en beats du rédacteur en chef.
 */

async function loadSeriesWithProduct(userId: string, seriesId: string) {
  const series = await db.query.contentSeries.findFirst({
    where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)),
    with: { product: true, contentSeriesPlatforms: { columns: { platform: true } } },
  });
  if (!series) throw new ApiError(404, "Series not found.");
  return series;
}

/** Les publics possibles d'une série : ceux du portrait de son sujet. Vide sans sujet ou sans portrait. */
export function readersOfProduct(product: { readerPortrait: unknown } | null | undefined): Reader[] {
  return parseStoredReaderPortrait(product?.readerPortrait)?.readers ?? [];
}

async function generateForm(userId: string, series: Awaited<ReturnType<typeof loadSeriesWithProduct>>, reader: Reader): Promise<SeriesForm> {
  const [profile, sampleEvents] = await Promise.all([
    db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { brandName: true, activityType: true } }),
    series.productId
      ? db.query.materialEvents.findMany({
          where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, series.productId)),
          columns: { title: true, audiences: true, audienceAngles: true, origin: true, qualifiedAt: true },
          orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
          limit: 60,
        })
      : Promise.resolve([]),
  ]);
  const portraitLabels = readersOfProduct(series.product).map((r) => r.label);
  const forReader = sampleEvents.filter((e) => tellableTo(e, reader.label, portraitLabels)).map((e) => e.title);
  return describeSeriesForm({
    brandName: profile?.brandName ?? "l'auteur",
    activityType: profile?.activityType ?? "",
    subjectName: series.product?.name ?? series.label,
    subjectDescription: series.product?.description ?? null,
    reader,
    seriesLabel: series.label,
    seriesDescription: series.description,
    platforms: series.contentSeriesPlatforms.map((p) => p.platform),
    sampleEvents: forReader.slice(0, 12),
  });
}

/**
 * L'auteur choisit le lecteur de la série parmi le portrait de son sujet ; la forme est écrite dans
 * la foulée (un appel). Choisir un autre lecteur réécrit la forme, même corrigée à la main : elle
 * était écrite pour quelqu'un d'autre.
 */
export async function setSeriesReader(userId: string, seriesId: string, readerLabel: string) {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (!series.productId) throw new ApiError(400, "Attach the series to a subject first: the reader is chosen among the subject's audiences.");
  const reader = readersOfProduct(series.product).find((r) => r.label === readerLabel);
  if (!reader) throw new ApiError(400, "This audience is not in the subject's reader portrait.");
  const form = await generateForm(userId, series, reader);
  await db.update(contentSeries).set({ readerLabel: reader.label, form }).where(eq(contentSeries.id, seriesId));
  return (await listActiveSeriesForUser(userId)).find((s) => s.id === seriesId) ?? null;
}

export const seriesFormEditSchema = seriesFormSchema.omit({ generatedAt: true, editedByUser: true });

/** Correction à la main de la forme : elle n'est plus réécrite, sauf changement de lecteur. */
export async function saveSeriesForm(userId: string, seriesId: string, input: Omit<SeriesForm, "generatedAt" | "editedByUser">) {
  const series = await loadSeriesWithProduct(userId, seriesId);
  const previous = parseStoredSeriesForm(series.form);
  const form: SeriesForm = { ...input, generatedAt: previous?.generatedAt ?? null, editedByUser: true };
  await db.update(contentSeries).set({ form }).where(eq(contentSeries.id, seriesId));
  return (await listActiveSeriesForUser(userId)).find((s) => s.id === seriesId) ?? null;
}

/**
 * Pour une série sans lecteur, prend le public principal du sujet et écrit la forme. Appelé à la
 * validation des séries en fin d'onboarding ; jamais bloquant, une série peut rester sans lecteur
 * (l'auteur le choisit alors dans la série).
 */
export async function ensureReaderForSeries(userId: string, seriesId: string): Promise<void> {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (series.readerLabel) return;
  const main = readersOfProduct(series.product)[0];
  if (!main) return;
  try {
    const form = await generateForm(userId, series, main);
    await db.update(contentSeries).set({ readerLabel: main.label, form }).where(eq(contentSeries.id, seriesId));
  } catch (err) {
    logger.error("Series form could not be written", err, { seriesId });
  }
}

export interface PlannedEvent {
  id: string;
  date: string | null;
  datePrecision: "day" | "month" | "unknown";
  title: string;
  whatHappened: string;
  whatChanged: string | null;
  kind: "failure" | "decision" | "result" | "feedback" | "milestone";
  audiences: string[];
  /** Ce que ce fait change pour le lecteur de cette série, dans ses mots. Null sans angle. */
  angle: string | null;
  /** Déjà raconté par un post de cette série. */
  told: boolean;
  scriptId: string | null;
}

export interface SeriesPlan {
  readerLabel: string | null;
  /** La ligne de temps du sujet vue par cette série, dans l'ordre. */
  events: PlannedEvent[];
  /** Le prochain épisode : le premier événement pas encore raconté, les datés d'abord. */
  next: PlannedEvent | null;
}

/**
 * Le plan d'une série n'est plus un objet à part (§4) : c'est la ligne de temps du sujet, filtrée
 * sur le lecteur (événements marqués pour lui, ou sans public), dans l'ordre des dates, en sautant
 * ce qu'un post de la série a déjà raconté.
 */
export async function planForSeries(userId: string, seriesId: string): Promise<SeriesPlan> {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (!series.productId) return { readerLabel: series.readerLabel, events: [], next: null };

  const [events, told] = await Promise.all([
    db.query.materialEvents.findMany({
      where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, series.productId)),
      orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
    }),
    db.query.scripts.findMany({
      where: and(eq(scripts.userId, userId), eq(scripts.seriesId, seriesId), isNotNull(scripts.eventId)),
      columns: { id: true, eventId: true },
    }),
  ]);
  const scriptByEvent = new Map(told.map((s) => [s.eventId as string, s.id]));
  // « Personne » veut dire personne (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §3.4) : un événement sans
  // angle pour ce lecteur ne part plus dans sa série. Trois exceptions seulement, dans tellableTo.
  const portraitLabels = readersOfProduct(series.product).map((r) => r.label);
  const forReader = events.filter((e) => tellableTo(e, series.readerLabel, portraitLabels));
  const planned: PlannedEvent[] = forReader.map((e) => ({
    id: e.id,
    date: e.date,
    datePrecision: e.datePrecision,
    title: e.title,
    whatHappened: e.whatHappened,
    whatChanged: e.whatChanged,
    kind: e.kind,
    audiences: e.audiences,
    angle: angleFor(e, series.readerLabel, portraitLabels),
    told: scriptByEvent.has(e.id),
    scriptId: scriptByEvent.get(e.id) ?? null,
  }));
  const next = planned.find((e) => !e.told && e.date !== null) ?? planned.find((e) => !e.told) ?? null;
  return { readerLabel: series.readerLabel, events: planned, next };
}

function toBriefEvent(e: PlannedEvent): BriefEvent {
  return { id: e.id, date: e.date, datePrecision: e.datePrecision, title: e.title, whatHappened: e.whatHappened, whatChanged: e.whatChanged, kind: e.kind, angle: e.angle };
}

/**
 * Le brief du rédacteur pour le prochain post de la série (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5) :
 * l'événement à raconter (le prochain du plan, ou celui qu'on réécrit), ses voisins, le lecteur, la
 * forme, et le document source en entier. Null si la série n'a pas de lecteur, pas de forme, ou plus
 * rien à raconter — la génération retombe alors sur le chemin V3.
 */
export async function buildEventBriefForSeries(userId: string, seriesId: string, lockedEventId: string | null): Promise<EventBrief | null> {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (!series.readerLabel || !series.productId) return null;
  const form = parseStoredSeriesForm(series.form);
  const reader = readersOfProduct(series.product).find((r) => r.label === series.readerLabel);
  if (!form || !reader) return null;

  const plan = await planForSeries(userId, seriesId);
  const chosen = lockedEventId ? (plan.events.find((e) => e.id === lockedEventId) ?? null) : plan.next;
  if (!chosen) return null;

  // Les voisins se prennent sur la ligne de temps complète du sujet (datés seulement), pas sur la
  // vue filtrée : « une semaine après la démo » doit rester vrai même si la démo visait un autre public.
  const all = await db.query.materialEvents.findMany({
    where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, series.productId)),
    orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
  });
  const timeline: BriefEvent[] = all.map((e) => ({ id: e.id, date: e.date, datePrecision: e.datePrecision, title: e.title, whatHappened: e.whatHappened, whatChanged: e.whatChanged, kind: e.kind }));
  const dated = timeline.filter((e) => e.date !== null);
  const index = dated.findIndex((e) => e.id === chosen.id);
  const before = index > 0 ? dated.slice(Math.max(0, index - 2), index) : [];
  const after = index >= 0 ? dated.slice(index + 1, index + 2) : [];

  const sourceId = all.find((e) => e.id === chosen.id)?.sourceMaterialId ?? null;
  const sourceRow = sourceId ? await db.query.sourceMaterials.findFirst({ where: eq(sourceMaterials.id, sourceId), columns: { id: true, title: true, rawText: true } }) : null;

  return {
    event: toBriefEvent(chosen),
    before,
    after,
    reader,
    form,
    seriesLabel: series.label,
    source: sourceRow ? { id: sourceRow.id, title: sourceRow.title, text: sourceRow.rawText } : null,
    timeline: dated,
  };
}

/** Le portrait du sujet d'une série, pour le sélecteur de lecteur. */
export async function readersForSeries(userId: string, seriesId: string): Promise<Reader[]> {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (!series.productId) return [];
  const product = await db.query.products.findFirst({ where: and(eq(products.id, series.productId), eq(products.userId, userId)) });
  return readersOfProduct(product);
}

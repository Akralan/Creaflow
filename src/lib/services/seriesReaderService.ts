import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, materialEvents, products, scripts, sourceMaterials } from "@/db/schema";
import { parseStoredReaderPortrait, type Reader } from "@/lib/llm/readerPortrait";
import type { TimelineEntry, WrittenPost } from "@/lib/llm/pointerPostWriter";
import { listActiveSeriesForUser } from "@/lib/services/seriesService";
import { ApiError } from "@/lib/api/errors";

/**
 * Le lecteur d'une série et la ligne de temps qu'elle raconte (docs/SPEC_EVENEMENT_POINTEUR.md §4).
 *
 * Il n'y a plus de tri par public : une série raconte la ligne de temps de son sujet, entière. Le
 * lecteur ne sert plus qu'à dire au rédacteur pour qui il écrit — c'est le seul usage qu'il avait
 * au banc, et c'est lui qui décide du registre du post.
 *
 * Il n'y a plus non plus de choix côté code : `planForSeries` ne désigne plus « le prochain
 * événement », c'est le rédacteur qui choisit dans la ligne de temps qu'on lui donne.
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

/**
 * L'auteur choisit le lecteur de la série parmi le portrait de son sujet. C'est tout ce que la série
 * dit au rédacteur : pour qui il écrit.
 */
export async function setSeriesReader(userId: string, seriesId: string, readerLabel: string) {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (!series.productId) throw new ApiError(400, "Attach the series to a subject first: the reader is chosen among the subject's audiences.");
  const reader = readersOfProduct(series.product).find((r) => r.label === readerLabel);
  if (!reader) throw new ApiError(400, "This audience is not in the subject's reader portrait.");
  await db.update(contentSeries).set({ readerLabel: reader.label }).where(eq(contentSeries.id, seriesId));
  return (await listActiveSeriesForUser(userId)).find((s) => s.id === seriesId) ?? null;
}

/**
 * Pour une série sans lecteur, prend le public principal du sujet. Appelé à la validation des séries
 * en fin d'onboarding ; jamais bloquant, une série peut rester sans lecteur.
 */
export async function ensureReaderForSeries(userId: string, seriesId: string): Promise<void> {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (series.readerLabel) return;
  const main = readersOfProduct(series.product)[0];
  if (!main) return;
  await db.update(contentSeries).set({ readerLabel: main.label }).where(eq(contentSeries.id, seriesId));
}

/** Un pointeur tel que la base le rend, avec le titre de son document. */
export interface PointerRow {
  id: string;
  line: number;
  date: string | null;
  sourceMaterialId: string;
  documentTitle: string | null;
}

/**
 * La ligne de temps que le rédacteur lit : une adresse par pointeur, marquée `used` quand un post de
 * la série s'en est déjà servi.
 *
 * Un pointeur dont le document n'est pas dans `documents` est ÉCARTÉ : son adresse serait
 * inouvrable, et le rédacteur recevrait `null:42`. Pur, pour être testable sans base.
 */
export function pointerTimeline(pointers: PointerRow[], toldIds: Set<string>, documents: Set<string>): TimelineEntry[] {
  return pointers
    .filter((p) => documents.has(p.sourceMaterialId) && p.documentTitle !== null)
    .map((p) => ({
      id: p.id,
      file: p.documentTitle as string,
      line: p.line,
      date: p.date,
      used: toldIds.has(p.id),
    }));
}

/** Tous les pointeurs que les posts d'une série ont déjà servis (`scripts.eventIds`, sinon `eventId`). */
export function toldPointerIds(posts: Array<{ eventIds: unknown; eventId: string | null }>): Set<string> {
  const ids = new Set<string>();
  for (const p of posts) {
    const list = Array.isArray(p.eventIds) ? p.eventIds : [];
    for (const id of list) if (typeof id === "string") ids.add(id);
    if (p.eventId) ids.add(p.eventId);
  }
  return ids;
}

/**
 * La ligne de temps réduite aux pointeurs imposés. C'est ainsi que les deux réseaux d'un même post
 * racontent la même chose (docs/SPEC_APP_DESIGN_TELLOVO.md E2) : la version X ne reçoit que les
 * pointeurs de la version LinkedIn, donc elle n'a rien d'autre à choisir. Même mécanisme pour
 * « autre idée, même brief », qui garde les pointeurs du post remplacé.
 *
 * Si AUCUN id imposé n'existe plus (document supprimé entre les deux versions), on rend la ligne de
 * temps entière : un post écrit sur autre chose vaut mieux qu'un créneau vide.
 *
 * La marque `used` est EFFACÉE sur les pointeurs imposés. Elle dit au rédacteur « un post publié
 * est déjà parti de là, ne le réécris pas » — or ici on lui demande exactement de le raconter, sur
 * l'autre réseau ou autrement. La laisser revenait à lui donner un seul choix en le lui
 * déconseillant.
 */
export function restrictToLocked(timeline: TimelineEntry[], lockedIds: string[]): TimelineEntry[] {
  if (lockedIds.length === 0) return timeline;
  const byId = new Map(timeline.map((e) => [e.id, e]));
  const kept = lockedIds
    .map((id) => byId.get(id))
    .filter((e): e is TimelineEntry => e !== undefined)
    .map((e) => ({ ...e, used: false }));
  return kept.length > 0 ? kept : timeline;
}

export interface SeriesPlan {
  readerLabel: string | null;
  /** La ligne de temps du sujet vue par cette série, dans l'ordre. Pour les écrans. */
  events: TimelineEntry[];
}

/** La ligne de temps d'une série, pour l'affichage. Elle ne désigne plus de « prochain » événement. */
export async function planForSeries(userId: string, seriesId: string): Promise<SeriesPlan> {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (!series.productId) return { readerLabel: series.readerLabel, events: [] };
  const { timeline } = await loadTimeline(userId, series.productId, seriesId);
  return { readerLabel: series.readerLabel, events: timeline };
}

async function loadTimeline(userId: string, productId: string, seriesId: string) {
  const [rows, posts, docs] = await Promise.all([
    db.query.materialEvents.findMany({
      where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, productId)),
      orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
      with: { sourceMaterial: { columns: { id: true, title: true } } },
    }),
    db.query.scripts.findMany({
      where: and(eq(scripts.userId, userId), eq(scripts.seriesId, seriesId)),
      columns: { id: true, eventId: true, eventIds: true, hookText: true, caption: true, createdAt: true },
      orderBy: asc(scripts.createdAt),
    }),
    db.query.sourceMaterials.findMany({
      where: and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, productId)),
      columns: { id: true, title: true, rawText: true },
    }),
  ]);

  const documents = new Set(docs.map((d) => d.id));
  const timeline = pointerTimeline(
    rows.map((r) => ({ id: r.id, line: r.line, date: r.date, sourceMaterialId: r.sourceMaterialId, documentTitle: r.sourceMaterial?.title ?? null })),
    toldPointerIds(posts),
    documents
  );
  return { timeline, posts, docs };
}

export interface PointerBrief {
  timeline: TimelineEntry[];
  posts: WrittenPost[];
  /** Le corpus adressable : titre de document -> ses lignes. */
  files: Map<string, string[]>;
  reader: Reader;
  projectContext: string;
}

/**
 * Tout ce que le rédacteur reçoit pour écrire le prochain post d'une série. Null quand la série n'a
 * pas de lecteur, pas de sujet, ou que sa ligne de temps est vide — la génération retombe alors sur
 * le chemin V3, comme avant.
 */
export async function buildPointerBrief(userId: string, seriesId: string, lockedIds: string[] = []): Promise<PointerBrief | null> {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (!series.readerLabel || !series.productId) return null;
  const reader = readersOfProduct(series.product).find((r) => r.label === series.readerLabel);
  if (!reader) return null;

  const { timeline: all, posts, docs } = await loadTimeline(userId, series.productId, seriesId);
  if (all.length === 0) return null;
  const timeline = restrictToLocked(all, lockedIds);

  const files = new Map<string, string[]>();
  for (const d of docs) if (d.title) files.set(d.title, d.rawText.split("\n"));

  const product = series.product;
  const projectContext = [
    product?.description ?? null,
    product?.problem ? `The problem it solves: ${product.problem}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    timeline,
    posts: posts
      .filter((p) => p.hookText || p.caption)
      .map((p) => ({
        id: p.id,
        date: p.createdAt.toISOString().slice(0, 10),
        text: [p.hookText, p.caption].filter(Boolean).join("\n\n"),
      })),
    files,
    reader,
    projectContext,
  };
}

/** Le portrait du sujet d'une série, pour le sélecteur de lecteur. */
export async function readersForSeries(userId: string, seriesId: string): Promise<Reader[]> {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (!series.productId) return [];
  const product = await db.query.products.findFirst({ where: and(eq(products.id, series.productId), eq(products.userId, userId)) });
  return readersOfProduct(product);
}

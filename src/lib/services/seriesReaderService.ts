import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, materialEvents, scripts, sourceMaterials } from "@/db/schema";
import { parseStoredReaderPortrait, type Reader } from "@/lib/llm/readerPortrait";
import type { TimelineEntry, WrittenPost } from "@/lib/llm/pointerPostWriter";
import type { Form, Genre } from "@/lib/llm/postForms";
import { ApiError } from "@/lib/api/errors";
import { DEFAULT_PHASE, type Phase } from "@/lib/phases";

/**
 * Le lecteur d'une série et la ligne de temps qu'elle raconte (docs/SPEC_EVENEMENT_POINTEUR.md §4).
 *
 * Il n'y a plus de tri par public : une série raconte la ligne de temps de son sujet, entière. Le
 * lecteur ne sert plus qu'à dire au rédacteur pour qui il écrit — c'est le seul usage qu'il avait
 * au banc, et c'est lui qui décide du registre du post.
 *
 * Il n'y a plus non plus de choix côté code : c'est le rédacteur qui choisit dans la ligne de temps
 * qu'on lui donne.
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
 * Pour une série sans lecteur, prend le public principal du sujet. Appelé à la création de la série
 * du projet par /start ; jamais bloquant, une série peut rester sans lecteur.
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
  /** Le genre et ses compléments (docs/FORMES_ET_GENRES.md) : ce que le rédacteur voit sur l'adresse. */
  genre: Genre;
  disponible: boolean;
  tient: string | null;
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
      genre: p.genre,
      disponible: p.disponible,
      tient: p.tient,
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

/** Un document qui raconte ce qui s'est passé (journal, commits, changelog), par opposition à ce qui
 *  est prévu ou décrit (spec, doc de référence). */
const LIVED_SOURCE = /commit log|devlog|dev-log|changelog|journal|history|retro|updates?\b|log\.md/i;
const PLANNED_SOURCE = /spec|rfc|design|plan|roadmap|architecture/i;

/** L'ordre de la réserve : ce qui fait une histoire avant ce qui fait un compte rendu. */
const BACKGROUND_GENRE_ORDER: Genre[] = [
  "déclencheur",
  "retour_utilisateur",
  "chiffre",
  "échec",
  "leçon",
  "engagement",
  "coulisse",
  "question",
  "réaction",
  "offre",
  "annonce",
  "décision",
  "livraison",
];

function sourceRank(file: string): number {
  if (LIVED_SOURCE.test(file)) return 0;
  if (PLANNED_SOURCE.test(file)) return 2;
  return 1;
}

/**
 * L'ordre de la ligne de temps (docs/TODO.md, « Pointeurs sans intérêt ») : les faits datés du plus
 * récent au plus ancien, puis ceux sans date, où les sources vécues passent avant les specs et les
 * genres qui font une histoire avant les décisions et livraisons de conception. Rien n'est coupé :
 * le 2026-10-26, une fenêtre des 60 faits les plus récents enfermait le rédacteur dans deux jours de
 * ménage d'écrans, et laissait hors de sa vue les moments forts plus anciens. Le tri se fait à
 * l'extraction, pas ici.
 *
 * Les pointeurs déjà racontés sont retirés (la liste des posts publiés dit ce qui est dit), sauf
 * ceux qu'un pointeur gardé « tient » : son post parle des deux. Une date future est un plan, pas un
 * fait : elle va dans la réserve. Pur, pour être testable sans base.
 */
export function focusTimeline(timeline: TimelineEntry[], today: string): TimelineEntry[] {
  const fresh = timeline.filter((e) => !e.used);
  const recent = fresh
    .filter((e) => e.date !== null && e.date.slice(0, 10) <= today)
    .sort((a, b) => (b.date as string).localeCompare(a.date as string) || sourceRank(a.file) - sourceRank(b.file));
  const taken = new Set(recent.map((e) => e.id));
  const background = fresh
    .filter((e) => !taken.has(e.id) && (e.date === null || e.date.slice(0, 10) > today))
    .sort(
      (a, b) =>
        sourceRank(a.file) - sourceRank(b.file) ||
        BACKGROUND_GENRE_ORDER.indexOf(a.genre) - BACKGROUND_GENRE_ORDER.indexOf(b.genre) ||
        a.file.localeCompare(b.file) ||
        a.line - b.line
    );
  const kept = [...recent, ...background];
  const keptIds = new Set(kept.map((e) => e.id));
  const byId = new Map(timeline.map((e) => [e.id, e]));
  for (const e of [...kept]) {
    const held = e.tient ? byId.get(e.tient) : undefined;
    if (held && !keptIds.has(held.id)) {
      kept.push(held);
      keptIds.add(held.id);
    }
  }
  return kept;
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
    rows.map((r) => ({
      id: r.id,
      line: r.line,
      date: r.date,
      sourceMaterialId: r.sourceMaterialId,
      documentTitle: r.sourceMaterial?.title ?? null,
      genre: r.genre,
      disponible: r.disponible,
      tient: r.tient,
    })),
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
  /** La forme imposée avec les pointeurs verrouillés (docs/FORMES_ET_GENRES.md, plan) : la forme
   *  suit les pointeurs, donc l'autre réseau et « another idea, same story » la reprennent. */
  lockedForm: Form | null;
  /** La phase du projet : elle décide des formes permises (src/lib/phases.ts). */
  phase: Phase;
  /** Tous les pointeurs du sujet, déjà racontés compris : le vérificateur des sources y cherche ce
   *  que le post raconte vraiment (src/lib/llm/pointerVerifier.ts). */
  allTimeline: TimelineEntry[];
}

/**
 * Tout ce que le rédacteur reçoit pour écrire le prochain post d'une série. Null quand la série n'a
 * pas de lecteur, pas de sujet, ou que sa ligne de temps est vide — la génération retombe alors sur
 * le chemin V3, comme avant.
 */
export async function buildPointerBrief(
  userId: string,
  seriesId: string,
  lockedIds: string[] = [],
  lockedForm: Form | null = null
): Promise<PointerBrief | null> {
  const series = await loadSeriesWithProduct(userId, seriesId);
  if (!series.productId) return null;
  // Le lecteur suit Business context : un « Who it's for » modifié refait le portrait sous d'autres
  // noms, et le nom retenu par la série peut ne plus exister. On prend alors le public principal
  // plutôt que de retomber en silence sur le prompt V3, comme c'était le cas jusqu'au 2026-10-26.
  const readers = readersOfProduct(series.product);
  const reader = readers.find((r) => r.label === series.readerLabel) ?? readers[0];
  if (!reader) return null;

  const { timeline: all, posts, docs } = await loadTimeline(userId, series.productId, seriesId);
  if (all.length === 0) return null;
  const timeline = lockedIds.length > 0 ? restrictToLocked(all, lockedIds) : focusTimeline(all, new Date().toISOString().slice(0, 10));

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
    // Sans pointeur verrouillé, la forme ne peut pas être imposée : le rédacteur la prend du genre.
    lockedForm: lockedIds.length > 0 ? lockedForm : null,
    phase: product?.phase ?? DEFAULT_PHASE,
    allTimeline: all,
  };
}

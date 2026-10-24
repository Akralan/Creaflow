import { after } from "next/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { materialEvents, products, sourceMaterials } from "@/db/schema";
import { extractPointers, type OpenEvent } from "@/lib/llm/pointerExtractor";
import { HOLDABLE_GENRES } from "@/lib/llm/postForms";
import { keepOldestTrigger, openEventsFor } from "@/lib/services/eventGenres";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

/**
 * Ligne de temps d'un sujet (docs/SPEC_EVENEMENT_POINTEUR.md §2-§3) : des POINTEURS, un par ligne de
 * document où il s'est passé quelque chose. Un événement est un document, une ligne, une date — et
 * rien d'autre. Celui qui veut savoir ce qu'il contient ouvre le document à cette ligne, ce que fait
 * le rédacteur.
 *
 * L'extraction n'est plus un appel agentique unique mais une passe indépendante par document
 * (`pointerExtractor`). C'est ce qui règle le défaut mesuré le 2026-10-22 : sur le dépôt tellovo, le
 * lecteur agentique lisait 4 documents sur 43 et s'arrêtait de lui-même au 107e tour en demandant la
 * permission de continuer, dans un travail de fond où personne ne lisait sa question.
 */

export type MaterialEvent = typeof materialEvents.$inferSelect;

async function requireOwnedProduct(userId: string, productId: string) {
  const product = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.userId, userId)) });
  if (!product) throw new ApiError(404, "Subject not found.");
  return product;
}

/** Ordre de lecture : les pointeurs datés dans l'ordre du temps, puis les non datés, chacun dans son
 *  ordre d'enregistrement. */
export async function listEventsForSubject(userId: string, productId: string) {
  await requireOwnedProduct(userId, productId);
  return db.query.materialEvents.findMany({
    where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, productId)),
    orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
    with: { sourceMaterial: { columns: { id: true, title: true } } },
  });
}

/**
 * Un pointeur ne se crée ni ne s'édite à la main : c'est une adresse dans un document, produite par
 * la lecture. Seule la suppression reste offerte à l'auteur — et elle n'efface rien du document.
 */
export async function deleteEventForUser(userId: string, eventId: string) {
  const [deleted] = await db
    .delete(materialEvents)
    .where(and(eq(materialEvents.id, eventId), eq(materialEvents.userId, userId)))
    .returning({ id: materialEvents.id });
  if (!deleted) throw new ApiError(404, "Event not found.");
}

export interface EventReadingReport {
  /** Documents qui restaient à lire au départ. */
  documents: number;
  /** Documents lus en entier et marqués comme tels. */
  documentsRead: number;
  /** Appels au modèle : une part de document par appel. */
  calls: number;
  pointers: number;
  /** Documents dont la lecture a échoué, laissés non lus pour la prochaine passe. */
  failed: number;
}

/**
 * La liste ouverte d'un sujet (docs/FORMES_ET_GENRES.md, règle 14) : ses engagements et annonces que
 * rien ne tient encore, et ses décisions, avec le texte de leur ligne. Rechargée avant chaque
 * document, pour qu'un document puisse tenir ce qu'un document lu juste avant a promis.
 */
async function loadOpenEvents(userId: string, productId: string): Promise<OpenEvent[]> {
  const rows = await db.query.materialEvents.findMany({
    where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, productId), inArray(materialEvents.genre, [...HOLDABLE_GENRES])),
    columns: { id: true, genre: true, date: true, line: true, sourceMaterialId: true },
  });
  if (rows.length === 0) return [];
  const held = await db
    .select({ id: materialEvents.tient })
    .from(materialEvents)
    .where(and(eq(materialEvents.productId, productId), inArray(materialEvents.tient, rows.map((r) => r.id))));
  const heldIds = new Set(held.map((h) => h.id).filter((id): id is string => id !== null));
  const docs = await db.query.sourceMaterials.findMany({
    where: inArray(sourceMaterials.id, [...new Set(rows.map((r) => r.sourceMaterialId))]),
    columns: { id: true, rawText: true },
  });
  const texts = new Map(docs.map((d) => [d.id, d.rawText.split("\n")]));
  return openEventsFor(
    rows.map((r) => ({ ...r, heldBy: heldIds.has(r.id) })),
    texts
  );
}

/** Règle 13 : un seul `déclencheur` par sujet, le plus ancien ; les autres redeviennent des livraisons. */
async function keepOneTrigger(userId: string, productId: string): Promise<void> {
  const triggers = await db.query.materialEvents.findMany({
    where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, productId), eq(materialEvents.genre, "déclencheur")),
    columns: { id: true, genre: true, date: true, createdAt: true },
  });
  const demoted = keepOldestTrigger(triggers);
  if (demoted.length > 0) {
    await db.update(materialEvents).set({ genre: "livraison" }).where(inArray(materialEvents.id, demoted));
  }
}

/**
 * La lecture : chaque document non lu passe par l'extracteur, ses pointeurs sont enregistrés avec
 * leur genre, et il est marqué lu. Un document qui échoue laisse `eventsReadAt` à null et n'empêche
 * pas les autres — il repassera à la prochaine ingestion.
 *
 * Plus de plafond de tours, plus d'ordre de lecture privilégié : les documents sont indépendants,
 * à une chose près — la liste ouverte, rechargée entre deux documents, pour que `tient` puisse
 * viser un événement du document précédent.
 */
export async function readEventsForSubject(userId: string, productId: string): Promise<EventReadingReport> {
  await requireOwnedProduct(userId, productId);
  const docs = await db.query.sourceMaterials.findMany({
    where: and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, productId), isNull(sourceMaterials.eventsReadAt)),
    columns: { id: true, title: true, rawText: true },
    orderBy: asc(sourceMaterials.createdAt),
  });
  if (docs.length === 0) return { documents: 0, documentsRead: 0, calls: 0, pointers: 0, failed: 0 };

  let documentsRead = 0;
  let calls = 0;
  let pointers = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      const open = await loadOpenEvents(userId, productId);
      const { pointers: found, calls: n } = await extractPointers({ file: doc.title ?? doc.id, text: doc.rawText }, open);
      calls += n;
      if (found.length > 0) {
        await db.insert(materialEvents).values(
          found.map((p) => ({
            userId,
            productId,
            sourceMaterialId: doc.id,
            line: p.line,
            date: p.date,
            genre: p.genre,
            disponible: p.disponible,
            tient: p.tient,
          }))
        );
        pointers += found.length;
      }
      await db.update(sourceMaterials).set({ eventsReadAt: new Date() }).where(eq(sourceMaterials.id, doc.id));
      documentsRead += 1;
    } catch (err) {
      failed += 1;
      logger.error("Pointer extraction failed for a document", err, { userId, productId, documentId: doc.id });
    }
  }

  await keepOneTrigger(userId, productId);

  const report = { documents: docs.length, documentsRead, calls, pointers, failed };
  logger.info("Pointer extraction finished", { userId, productId, ...report });
  return report;
}

/**
 * Une seule lecture à la fois par sujet dans ce processus : si une lecture tourne déjà, on note
 * qu'il faudra relire à la fin (les documents arrivés entre-temps ont `eventsReadAt` null, ils
 * seront pris à ce moment-là). Suffisant pour un déploiement à un seul conteneur.
 */
const runningReads = new Map<string, Promise<void>>();
const rerunRequested = new Set<string>();

export function readEventsInBackground(userId: string, productId: string | null): Promise<void> {
  if (!productId) return Promise.resolve(); // matière de niveau marque : pas de ligne de temps
  const key = `${userId}:${productId}`;
  const running = runningReads.get(key);
  if (running) {
    rerunRequested.add(key);
    return running;
  }
  const run = (async () => {
    try {
      do {
        rerunRequested.delete(key);
        await readEventsForSubject(userId, productId);
      } while (rerunRequested.has(key));
    } catch (err) {
      logger.error("Event reading failed", err, { userId, productId });
    } finally {
      runningReads.delete(key);
    }
  })();
  runningReads.set(key, run);
  return run;
}

/**
 * À appeler à chaque ingestion de matière : lance la lecture après la réponse HTTP (`after()`), ou
 * tout de suite hors contexte de requête (tests, scripts), sans jamais bloquer ni faire échouer
 * l'ingestion.
 */
export function scheduleEventReading(userId: string, productId: string | null): void {
  if (!productId) return;
  const run = () => readEventsInBackground(userId, productId);
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * Remet tous les documents d'un sujet à relire. Les pointeurs existants tombent avec leur document
 * à la prochaine passe : on les supprime donc ici, sinon la relecture les doublerait.
 */
export async function markMaterialForReReading(userId: string, productId: string): Promise<void> {
  await db.delete(materialEvents).where(and(eq(materialEvents.userId, userId), eq(materialEvents.productId, productId)));
  await db
    .update(sourceMaterials)
    .set({ eventsReadAt: null })
    .where(and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, productId)));
  logger.info("Material marked for re-reading", { userId, productId });
}

/** Nombre de documents qui attendent une lecture, pour l'écran du sujet. */
export async function countUnreadDocuments(userId: string, productId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sourceMaterials)
    .where(and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, productId), isNull(sourceMaterials.eventsReadAt)));
  return rows[0]?.n ?? 0;
}

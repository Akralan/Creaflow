import { after } from "next/server";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, materialEvents, products, sourceMaterials } from "@/db/schema";
import { callAgentic } from "@/lib/llm/provider";
import {
  buildEventReaderSystemPrompt,
  buildEventReaderTools,
  buildEventReaderUserMessage,
  excerptIsInDocument,
  LIST_DOCUMENTS_TOOL,
  maxTurnsForParts,
  MAX_EXCERPT_CHARS,
  normalizeEventDate,
  READ_DOCUMENT_TOOL,
  SAVE_EVENT_TOOL,
  saveEventInputSchema,
  splitDocumentIntoParts,
  type DatePrecision,
  type EventKind,
} from "@/lib/llm/eventReader";
import { parseStoredReaderPortrait } from "@/lib/llm/readerPortrait";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

/**
 * Ligne de temps d'un sujet (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3) : les événements lus dans la
 * matière par le lecteur d'événements, plus ceux que l'auteur ajoute à la main. C'est elle que le plan
 * d'une série et le rédacteur consultent, à la place des documents et des résumés.
 */

export type MaterialEvent = typeof materialEvents.$inferSelect;

async function requireOwnedProduct(userId: string, productId: string) {
  const product = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.userId, userId)) });
  if (!product) throw new ApiError(404, "Sujet introuvable.");
  return product;
}

/** Ordre de lecture : les événements datés dans l'ordre du temps, puis les non datés, chacun dans son
 *  ordre d'enregistrement. */
export async function listEventsForSubject(userId: string, productId: string) {
  await requireOwnedProduct(userId, productId);
  return db.query.materialEvents.findMany({
    where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, productId)),
    orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
    with: { sourceMaterial: { columns: { id: true, title: true } } },
  });
}

export interface UserEventInput {
  productId: string;
  date: string;
  datePrecision: DatePrecision;
  title: string;
  whatHappened: string;
  whatChanged?: string | null;
  kind: EventKind;
  audiences?: string[];
}

/** « Il s'est passé ça » : l'auteur écrit un événement lui-même, sans document derrière. */
export async function createEventByUser(userId: string, input: UserEventInput) {
  await requireOwnedProduct(userId, input.productId);
  let normalized;
  try {
    normalized = normalizeEventDate(input.date, input.datePrecision);
  } catch (err) {
    throw new ApiError(400, err instanceof Error ? err.message : "Date invalide.");
  }
  const [row] = await db
    .insert(materialEvents)
    .values({
      userId,
      productId: input.productId,
      date: normalized.date,
      datePrecision: normalized.datePrecision,
      title: input.title.trim(),
      whatHappened: input.whatHappened.trim(),
      whatChanged: input.whatChanged?.trim() || null,
      kind: input.kind,
      audiences: input.audiences ?? [],
      origin: "user",
    })
    .returning();
  return row;
}

export interface EventPatch {
  date?: string;
  datePrecision?: DatePrecision;
  title?: string;
  whatHappened?: string;
  whatChanged?: string | null;
  kind?: EventKind;
  audiences?: string[];
}

export async function updateEventForUser(userId: string, eventId: string, patch: EventPatch) {
  const existing = await db.query.materialEvents.findFirst({ where: and(eq(materialEvents.id, eventId), eq(materialEvents.userId, userId)) });
  if (!existing) throw new ApiError(404, "Événement introuvable.");

  const set: Partial<typeof materialEvents.$inferInsert> = { updatedAt: new Date() };
  if (patch.date !== undefined || patch.datePrecision !== undefined) {
    const precision = patch.datePrecision ?? existing.datePrecision;
    const date = patch.date ?? existing.date ?? "";
    try {
      const normalized = normalizeEventDate(date, precision);
      set.date = normalized.date;
      set.datePrecision = normalized.datePrecision;
    } catch (err) {
      throw new ApiError(400, err instanceof Error ? err.message : "Date invalide.");
    }
  }
  if (patch.title !== undefined) set.title = patch.title.trim();
  if (patch.whatHappened !== undefined) set.whatHappened = patch.whatHappened.trim();
  if (patch.whatChanged !== undefined) set.whatChanged = patch.whatChanged?.trim() || null;
  if (patch.kind !== undefined) set.kind = patch.kind;
  if (patch.audiences !== undefined) set.audiences = patch.audiences;

  const [row] = await db.update(materialEvents).set(set).where(eq(materialEvents.id, eventId)).returning();
  return row;
}

export async function deleteEventForUser(userId: string, eventId: string) {
  const [deleted] = await db
    .delete(materialEvents)
    .where(and(eq(materialEvents.id, eventId), eq(materialEvents.userId, userId)))
    .returning({ id: materialEvents.id });
  if (!deleted) throw new ApiError(404, "Événement introuvable.");
}

export interface EventReadingReport {
  /** Documents qui restaient à lire au départ. */
  documents: number;
  /** Documents lus en entier et marqués comme tels. */
  documentsRead: number;
  partsRead: number;
  eventsSaved: number;
  /** Enregistrements refusés (passage introuvable, date impossible…) et renvoyés au modèle. */
  eventsRejected: number;
  turns: number;
  stoppedAtMaxTurns: boolean;
  reply: string;
}

/**
 * La lecture elle-même : un agent avec trois outils lit tous les documents du sujet pas encore lus,
 * en entier, et enregistre les événements au fil de la lecture. Synchrone et long (plusieurs minutes
 * sur un gros sujet) : les appelants qui ne veulent pas attendre passent par `readEventsInBackground`.
 */
export async function readEventsForSubject(userId: string, productId: string): Promise<EventReadingReport> {
  const product = await requireOwnedProduct(userId, productId);
  const [profile, allDocs, existingEvents] = await Promise.all([
    db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { brandName: true } }),
    db.query.sourceMaterials.findMany({
      where: and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, productId)),
      columns: { id: true, title: true, rawText: true, eventsReadAt: true },
      orderBy: asc(sourceMaterials.createdAt),
    }),
    db.query.materialEvents.findMany({
      where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, productId)),
      columns: { date: true, title: true },
      orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
    }),
  ]);

  const unread = allDocs.filter((d) => d.eventsReadAt === null);
  if (unread.length === 0) {
    return { documents: 0, documentsRead: 0, partsRead: 0, eventsSaved: 0, eventsRejected: 0, turns: 0, stoppedAtMaxTurns: false, reply: "Rien à lire." };
  }

  const docsById = new Map(unread.map((d) => [d.id, { ...d, parts: splitDocumentIntoParts(d.rawText), partsRead: new Set<number>() }]));
  const totalParts = [...docsById.values()].reduce((sum, d) => sum + d.parts.length, 0);
  const readers = parseStoredReaderPortrait(product.readerPortrait)?.readers ?? [];
  const audienceLabels = readers.map((r) => r.label);

  const context = {
    brandName: profile?.brandName ?? "l'auteur",
    subjectName: product.name,
    subjectDescription: product.description,
    audiences: readers.map((r) => ({ label: r.label, who: r.who })),
    unreadDocuments: unread.length,
    alreadyReadDocuments: allDocs.length - unread.length,
    existingEvents: existingEvents.slice(0, 150),
  };

  let eventsSaved = 0;
  let eventsRejected = 0;
  let partsRead = 0;

  const result = await callAgentic({
    system: buildEventReaderSystemPrompt(context),
    messages: [{ role: "user", content: buildEventReaderUserMessage(context) }],
    tools: buildEventReaderTools({ audienceLabels }),
    maxTokens: 4096,
    maxTurns: maxTurnsForParts(totalParts),
    // La qualité de lecture compte plus que la latence : une lecture se fait une fois par document.
    effort: "medium",
    onToolCall: async ({ name, input }) => {
      if (name === LIST_DOCUMENTS_TOOL) {
        return {
          documents: [...docsById.values()].map((d) => ({
            id: d.id,
            title: d.title ?? "(sans titre)",
            chars: d.rawText.length,
            parts: d.parts.length,
            partsRead: [...d.partsRead].sort((a, b) => a - b),
          })),
        };
      }

      if (name === READ_DOCUMENT_TOOL) {
        const { documentId, part } = input as { documentId?: string; part?: number };
        const doc = documentId ? docsById.get(documentId) : undefined;
        if (!doc) throw new Error("Document inconnu : reprends l'id dans list_documents.");
        const index = Number(part);
        if (!Number.isInteger(index) || index < 1 || index > doc.parts.length) {
          throw new Error(`Partie ${part} inexistante : ce document a ${doc.parts.length} partie(s).`);
        }
        if (!doc.partsRead.has(index)) partsRead++;
        doc.partsRead.add(index);
        return { id: doc.id, title: doc.title, part: index, parts: doc.parts.length, text: doc.parts[index - 1] };
      }

      if (name === SAVE_EVENT_TOOL) {
        const parsed = saveEventInputSchema.safeParse(input);
        if (!parsed.success) {
          eventsRejected++;
          throw new Error(`Événement refusé : ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
        }
        const data = parsed.data;
        const doc = docsById.get(data.sourceMaterialId);
        if (!doc) {
          eventsRejected++;
          throw new Error("sourceMaterialId inconnu : reprends l'id du document que tu es en train de lire.");
        }
        if (data.excerpt.length > MAX_EXCERPT_CHARS) {
          eventsRejected++;
          throw new Error(`Passage trop long (${data.excerpt.length} caractères, ${MAX_EXCERPT_CHARS} au plus) : recopie seulement la phrase qui prouve l'événement.`);
        }
        if (!excerptIsInDocument(data.excerpt, doc.rawText)) {
          eventsRejected++;
          throw new Error("Passage introuvable dans le document : recopie-le tel quel, sans reformuler, plus court si besoin.");
        }
        const unknownAudiences = data.audiences.filter((a) => !audienceLabels.includes(a));
        if (unknownAudiences.length > 0) {
          eventsRejected++;
          throw new Error(`Public inconnu : ${unknownAudiences.join(", ")}. Publics possibles : ${audienceLabels.join(", ") || "aucun"}.`);
        }
        let normalized;
        try {
          normalized = normalizeEventDate(data.date, data.datePrecision);
        } catch (err) {
          eventsRejected++;
          throw err;
        }
        const [row] = await db
          .insert(materialEvents)
          .values({
            userId,
            productId,
            date: normalized.date,
            datePrecision: normalized.datePrecision,
            title: data.title,
            whatHappened: data.whatHappened,
            whatChanged: data.whatChanged || null,
            kind: data.kind,
            audiences: data.audiences,
            sourceMaterialId: doc.id,
            excerpt: data.excerpt,
            origin: "reader",
          })
          .returning({ id: materialEvents.id });
        eventsSaved++;
        return { saved: true, id: row.id, note: "Enregistré. Continue la lecture." };
      }

      throw new Error(`Outil inconnu : ${name}`);
    },
  });

  // Un document compte comme lu seulement si toutes ses parties l'ont été : une lecture interrompue
  // au plafond de tours reprendra là où elle s'est arrêtée, sans rien perdre.
  const fullyRead = [...docsById.values()].filter((d) => d.partsRead.size === d.parts.length).map((d) => d.id);
  if (fullyRead.length > 0) {
    await db.update(sourceMaterials).set({ eventsReadAt: new Date() }).where(inArray(sourceMaterials.id, fullyRead));
  }

  const report: EventReadingReport = {
    documents: unread.length,
    documentsRead: fullyRead.length,
    partsRead,
    eventsSaved,
    eventsRejected,
    turns: result.turns,
    stoppedAtMaxTurns: result.stoppedAtMaxTurns,
    reply: result.reply,
  };
  logger.info("Lecture des événements terminée", { userId, productId, ...report, reply: undefined });
  return report;
}

/**
 * Lecture en arrière-plan, déclenchée à chaque ingestion de matière. Une seule lecture à la fois par
 * sujet dans ce processus : si une lecture tourne déjà, on note qu'il faudra relire à la fin (les
 * documents arrivés entre-temps ont eventsReadAt null, ils seront pris à ce moment-là). Suffisant pour
 * un déploiement à un seul conteneur ; à revoir avec plusieurs instances.
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
      logger.error("Lecture des événements échouée", err, { userId, productId });
    } finally {
      runningReads.delete(key);
    }
  })();
  runningReads.set(key, run);
  return run;
}

/**
 * À appeler à chaque ingestion de matière, là où `markStaleForMaterialIngestion` l'était : lance la
 * lecture après la réponse HTTP (`after()`), ou tout de suite hors contexte de requête (tests,
 * scripts), sans jamais bloquer ni faire échouer l'ingestion.
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

/** Nombre de documents qui attendent une lecture, pour l'écran du sujet. */
export async function countUnreadDocuments(userId: string, productId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sourceMaterials)
    .where(and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, productId), isNull(sourceMaterials.eventsReadAt)));
  return rows[0]?.n ?? 0;
}

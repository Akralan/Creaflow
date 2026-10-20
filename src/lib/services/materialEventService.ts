import { after } from "next/server";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, creatorProfiles, materialEvents, products, scripts, sourceMaterials } from "@/db/schema";
import { callAgentic } from "@/lib/llm/provider";
import {
  buildEventReaderSystemPrompt,
  buildEventReaderTools,
  buildEventReaderUserMessage,
  excerptIsInDocument,
  LIST_DOCUMENTS_TOOL,
  datedEntryCount,
  maxTurnsForReading,
  narrativeFirst,
  MAX_EXCERPT_CHARS,
  normalizeEventDate,
  READ_DOCUMENT_TOOL,
  COMPLETE_EVENT_TOOL,
  completeEventInputSchema,
  SAVE_EVENT_TOOL,
  saveEventInputSchema,
  splitDocumentIntoParts,
  type DatePrecision,
  type EventKind,
} from "@/lib/llm/eventReader";
import { parseStoredReaderPortrait } from "@/lib/llm/readerPortrait";
import { matchPromiseToEvent } from "@/lib/llm/promiseMatch";
import { candidateEvents, matchIsStillOpen, openPromises } from "@/lib/narrative/promises";
import { audiencesOf, parseAudienceAngles } from "@/lib/narrative/audience";
import { applicableFixes, synthesiseTimeline } from "@/lib/llm/timelineSynthesis";
import { toIsoDate } from "@/lib/seriesRhythm";
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
  if (!product) throw new ApiError(404, "Subject not found.");
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
  if (!existing) throw new ApiError(404, "Event not found.");

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
  if (!deleted) throw new ApiError(404, "Event not found.");
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
      columns: { id: true, date: true, title: true },
      orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
    }),
  ]);

  const unread = allDocs.filter((d) => d.eventsReadAt === null);
  if (unread.length === 0) {
    return { documents: 0, documentsRead: 0, partsRead: 0, eventsSaved: 0, eventsRejected: 0, turns: 0, stoppedAtMaxTurns: false, reply: "Nothing to read." };
  }

  // La matière qui raconte d'abord (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §5) : `list_documents` rend
  // les documents dans cet ordre, donc le devlog est lu quand le budget de tours est intact. Sur le
  // pack MyKiné, l'ordre d'insertion plaçait treize fichiers de documentation avant lui.
  const docsById = new Map(narrativeFirst(unread).map((d) => [d.id, { ...d, parts: splitDocumentIntoParts(d.rawText), partsRead: new Set<number>() }]));
  const totalParts = [...docsById.values()].reduce((sum, d) => sum + d.parts.length, 0);
  // Le budget compte aussi les enregistrements : un journal de onze entrées tient dans une seule
  // partie, et chaque save_event coûte un tour (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §5).
  const expectedEvents = Math.max(10, unread.reduce((sum, d) => sum + datedEntryCount(d.rawText), 0));
  const readers = parseStoredReaderPortrait(product.readerPortrait)?.readers ?? [];
  const audienceLabels = readers.map((r) => r.label);

  const context = {
    brandName: profile?.brandName ?? "l'auteur",
    subjectName: product.name,
    subjectDescription: product.description,
    audiences: readers.map((r) => ({ label: r.label, who: r.who, wants: r.wants, stopsFor: r.stopsFor, turnsOff: r.turnsOff, words: r.words })),
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
    maxTurns: maxTurnsForReading({ parts: totalParts, expectedEvents }),
    // La qualité de lecture compte plus que la latence : une lecture se fait une fois par document.
    effort: "medium",
    onToolCall: async ({ name, input }) => {
      if (name === LIST_DOCUMENTS_TOOL) {
        return {
          documents: [...docsById.values()].map((d) => ({
            id: d.id,
            title: d.title ?? "(untitled)",
            chars: d.rawText.length,
            parts: d.parts.length,
            partsRead: [...d.partsRead].sort((a, b) => a - b),
          })),
        };
      }

      if (name === READ_DOCUMENT_TOOL) {
        const { documentId, part } = input as { documentId?: string; part?: number };
        const doc = documentId ? docsById.get(documentId) : undefined;
        if (!doc) throw new Error("Unknown document: take the id from list_documents.");
        const index = Number(part);
        if (!Number.isInteger(index) || index < 1 || index > doc.parts.length) {
          throw new Error(`Part ${part} does not exist: this document has ${doc.parts.length} part(s).`);
        }
        if (!doc.partsRead.has(index)) partsRead++;
        doc.partsRead.add(index);
        return { id: doc.id, title: doc.title, part: index, parts: doc.parts.length, text: doc.parts[index - 1] };
      }

      if (name === SAVE_EVENT_TOOL) {
        const parsed = saveEventInputSchema.safeParse(input);
        if (!parsed.success) {
          eventsRejected++;
          throw new Error(`Event rejected: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
        }
        const data = parsed.data;
        const doc = docsById.get(data.sourceMaterialId);
        if (!doc) {
          eventsRejected++;
          throw new Error("Unknown sourceMaterialId: use the id of the document you are currently reading.");
        }
        if (data.excerpt.length > MAX_EXCERPT_CHARS) {
          eventsRejected++;
          throw new Error(`Excerpt too long (${data.excerpt.length} characters, ${MAX_EXCERPT_CHARS} at most): copy only the sentence that proves the event.`);
        }
        if (!excerptIsInDocument(data.excerpt, doc.rawText)) {
          eventsRejected++;
          throw new Error("Excerpt not found in the document: copy it verbatim, without rephrasing, shorter if needed.");
        }
        // Un angle qui nomme un public absent du portrait est retiré, pas fatal : le modèle peut
        // inventer une étiquette, ça ne doit pas coûter l'événement (SPEC_EVENEMENTS_PAR_CIBLE §3).
        const angles = parseAudienceAngles(data.audienceAngles, audienceLabels);
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
            atStake: data.atStake || null,
            kind: data.kind,
            audiences: audiencesOf(angles),
            audienceAngles: angles,
            qualifiedAt: new Date(),
            sourceMaterialId: doc.id,
            excerpt: data.excerpt,
            origin: "reader",
          })
          .returning({ id: materialEvents.id });
        eventsSaved++;
        return { saved: true, id: row.id, note: "Saved. Keep reading." };
      }

      if (name === COMPLETE_EVENT_TOOL) {
        const parsed = completeEventInputSchema.safeParse(input);
        if (!parsed.success) {
          throw new Error(`Completion refused: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
        }
        const patch = parsed.data;
        // L'événement doit appartenir à ce sujet et à cet utilisateur : un id pris ailleurs est
        // refusé et renvoyé au modèle, jamais appliqué.
        const existing = await db.query.materialEvents.findFirst({
          where: and(eq(materialEvents.id, patch.id), eq(materialEvents.userId, userId), eq(materialEvents.productId, productId)),
        });
        if (!existing) throw new Error("Unknown event id: take it from the already-saved list of THIS subject.");

        const set: Partial<typeof materialEvents.$inferInsert> = { updatedAt: new Date() };
        if (patch.date !== undefined && patch.datePrecision !== undefined) {
          const normalized = normalizeEventDate(patch.date, patch.datePrecision);
          set.date = normalized.date;
          set.datePrecision = normalized.datePrecision;
        }
        if (patch.whatChanged !== undefined && patch.whatChanged) set.whatChanged = patch.whatChanged;
        if (patch.atStake !== undefined && patch.atStake) set.atStake = patch.atStake;
        if (patch.excerpt !== undefined) {
          const doc = [...docsById.values()].find((d) => excerptIsInDocument(patch.excerpt as string, d.rawText));
          if (!doc) throw new Error("Excerpt not found in any document you are reading: copy it verbatim.");
          set.excerpt = patch.excerpt;
          set.sourceMaterialId = doc.id;
        }
        if (patch.audienceAngles !== undefined) {
          // Les angles s'ajoutent aux existants : un second document peut parler à un public de plus.
          const merged = [...parseAudienceAngles(existing.audienceAngles, audienceLabels)];
          for (const angle of parseAudienceAngles(patch.audienceAngles, audienceLabels)) {
            const at = merged.findIndex((m) => m.audience === angle.audience);
            if (at === -1) merged.push(angle);
            else merged[at] = angle;
          }
          set.audienceAngles = merged;
          set.audiences = audiencesOf(merged);
          set.qualifiedAt = new Date();
        }
        await db.update(materialEvents).set(set).where(eq(materialEvents.id, patch.id));
        return { completed: true, note: "Completed. Keep reading." };
      }

      throw new Error(`Unknown tool: ${name}`);
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
  logger.info("Event reading finished", { userId, productId, ...report, reply: undefined });

  // Tout est lu : la ligne de temps se relit d'un bloc (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §5).
  // Jamais bloquant : une panne ici ne doit pas annuler une lecture qui a duré des minutes.
  try {
    await synthesiseTimelineForSubject(userId, productId);
  } catch (error) {
    logger.error("Timeline synthesis failed", error, { userId, productId });
  }
  // De nouveaux événements, donc peut-être une promesse enfin tenable (docs/SPEC_FIL_NARRATIF.md §8).
  // Jamais bloquant : une panne ici ne doit pas faire échouer une lecture qui a duré des minutes.
  if (eventsSaved > 0) {
    try {
      await refreshPromiseMatches(userId, productId);
    } catch (error) {
      logger.error("Promise pairing failed after the material re-read", error, { userId, productId });
    }
  }
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
      logger.error("Event reading failed", err, { userId, productId });
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

/**
 * Relit la ligne de temps d'un bloc et applique ce que le code accepte (§5) : fusionner, compléter,
 * retirer. Jamais créer. Un événement déjà raconté par un post ne bouge pas — un script pointe
 * dessus. Rend le nombre de corrections appliquées.
 */
export async function synthesiseTimelineForSubject(userId: string, productId: string): Promise<number> {
  const product = await requireOwnedProduct(userId, productId);
  const [events, told] = await Promise.all([
    db.query.materialEvents.findMany({
      where: and(eq(materialEvents.userId, userId), eq(materialEvents.productId, productId)),
      orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
    }),
    db.query.scripts.findMany({ where: and(eq(scripts.userId, userId), isNotNull(scripts.eventId)), columns: { eventId: true } }),
  ]);
  if (events.length === 0) return 0;

  const fixes = await synthesiseTimeline({
    subjectName: product.name,
    events: events.map((e) => ({ id: e.id, date: e.date, title: e.title, whatHappened: e.whatHappened, whatChanged: e.whatChanged, audiences: e.audiences })),
  });
  const toApply = applicableFixes(
    fixes,
    events.map((e) => e.id),
    told.map((t) => t.eventId as string)
  );

  const byId = new Map(events.map((e) => [e.id, e]));
  let applied = 0;
  for (const fix of toApply) {
    const event = byId.get(fix.eventId);
    if (!event) continue;
    if (fix.action === "drop") {
      await db.delete(materialEvents).where(eq(materialEvents.id, fix.eventId));
    } else if (fix.action === "merge") {
      const into = byId.get(fix.intoEventId as string);
      if (!into) continue;
      // Ce que l'absorbé avait et que l'absorbant n'a pas : une date, une suite, un public de plus.
      const set: Partial<typeof materialEvents.$inferInsert> = { updatedAt: new Date() };
      if (!into.date && event.date) {
        set.date = event.date;
        set.datePrecision = event.datePrecision;
      }
      if (!into.whatChanged && event.whatChanged) set.whatChanged = event.whatChanged;
      const merged = [...parseAudienceAngles(into.audienceAngles, into.audiences), ...parseAudienceAngles(event.audienceAngles, event.audiences)];
      const unique = merged.filter((a, i) => merged.findIndex((m) => m.audience === a.audience) === i);
      if (unique.length > 0) {
        set.audienceAngles = unique;
        set.audiences = audiencesOf(unique);
      }
      await db.update(materialEvents).set(set).where(eq(materialEvents.id, into.id));
      await db.delete(materialEvents).where(eq(materialEvents.id, fix.eventId));
    } else {
      await db.update(materialEvents).set({ whatChanged: fix.whatChanged, updatedAt: new Date() }).where(eq(materialEvents.id, fix.eventId));
    }
    applied += 1;
  }
  if (applied > 0) logger.info("Timeline cleaned up", { userId, productId, applied, proposed: fixes.length });
  return applied;
}

/**
 * Un changement de public remet la matière à lire (docs/SPEC_EVENEMENTS_PAR_CIBLE.md §3.6). On ne
 * redistribue PAS des étiquettes sur des événements écrits pour quelqu'un d'autre : la ligne qui dit
 * ce qu'un fait change pour un lecteur ne peut s'écrire qu'avec le document sous les yeux.
 *
 * Ne déclenche rien de lui-même : la relecture part à la prochaine ingestion ou sur « Relire la
 * matière ». Une relecture dure des minutes, elle ne se lance pas en silence.
 */
export async function markMaterialForReReading(userId: string, productId: string): Promise<void> {
  await db
    .update(sourceMaterials)
    .set({ eventsReadAt: null })
    .where(and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, productId)));
  logger.info("Material marked for re-reading after an audience change", { userId, productId });
}
/** Nombre de documents qui attendent une lecture, pour l'écran du sujet. */
export async function countUnreadDocuments(userId: string, productId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(sourceMaterials)
    .where(and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, productId), isNull(sourceMaterials.eventsReadAt)));
  return rows[0]?.n ?? 0;
}

/**
 * Apparie les promesses encore ouvertes des posts publiés aux événements survenus depuis
 * (docs/SPEC_FIL_NARRATIF.md §8). Tourne après chaque relecture de la matière, et pas à l'écriture
 * d'un post : c'est ce qui évite un appel au modèle à chaque génération. Le résultat vit sur le
 * script QUI A FAIT la promesse (`promiseMatch`), vidé quand le post de promesse tenue est écrit.
 *
 * Jamais bloquant : rendre 0 veut simplement dire « pas de promesse tenue à écrire ».
 */
export async function refreshPromiseMatches(userId: string, productId: string): Promise<number> {
  const [published, honoredRows, toldRows, timeline, slots] = await Promise.all([
    db.query.scripts.findMany({
      where: and(eq(scripts.userId, userId), eq(scripts.productId, productId), eq(scripts.status, "published")),
      columns: { id: true, title: true, hookText: true, hookVisual: true, caption: true, promisesMade: true, promiseMatch: true, createdAt: true },
    }),
    db.query.scripts.findMany({ where: and(eq(scripts.userId, userId), isNotNull(scripts.promiseHonored)), columns: { promiseHonored: true } }),
    db.query.scripts.findMany({ where: and(eq(scripts.userId, userId), isNotNull(scripts.eventId)), columns: { eventId: true } }),
    listEventsForSubject(userId, productId),
    db.query.calendarEntries.findMany({ where: eq(calendarEntries.userId, userId), columns: { scriptId: true, scheduledDate: true } }),
  ]);

  const dateOfScript = new Map(slots.filter((s) => s.scriptId).map((s) => [s.scriptId as string, toIsoDate(s.scheduledDate)]));
  const honored = honoredRows.map((r) => r.promiseHonored as string);
  const told = toldRows.map((r) => r.eventId as string);
  const byId = new Map(published.map((s) => [s.id, s]));

  const posts = published
    // Un appariement encore ouvert occupe la place ; devenu caduc (sa promesse a été tenue), il
    // libère le post pour ses autres promesses.
    .filter((s) => (!s.promiseMatch || !matchIsStillOpen(s.promiseMatch, honored)) && Array.isArray(s.promisesMade) && s.promisesMade.length > 0)
    .map((s) => ({ scriptId: s.id, date: dateOfScript.get(s.id) ?? toIsoDate(s.createdAt), promisesMade: s.promisesMade as string[] }));

  let matched = 0;
  // Une promesse par post : la plus ancienne ouverte. Les autres attendront leur tour.
  const seen = new Set<string>();
  for (const open of openPromises(posts, honored)) {
    if (seen.has(open.scriptId)) continue;
    seen.add(open.scriptId);
    const post = byId.get(open.scriptId);
    if (!post) continue;
    const candidates = candidateEvents(timeline, open.date, told).map((e) => ({ id: e.id, date: e.date, title: e.title, whatHappened: e.whatHappened }));
    const eventId = await matchPromiseToEvent({
      promise: open.promise,
      postText: [post.title, post.hookText, post.hookVisual, post.caption].filter(Boolean).join("\n"),
      candidates,
    });
    if (!eventId) continue;
    await db.update(scripts).set({ promiseMatch: { promise: open.promise, eventId } }).where(eq(scripts.id, open.scriptId));
    matched += 1;
  }
  if (matched > 0) logger.info("Promises paired with an event", { userId, productId, matched });
  return matched;
}

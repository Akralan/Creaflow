import { and, asc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, contentSeries, creatorProfiles, materialSources, products, scripts, sourceMaterials, startJobs, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { firstPostEmail, loginLinkEmail } from "@/lib/email/templates";
import { llmFailureMessage } from "@/lib/llm/errors";
import { logger } from "@/lib/logger";
import { generateAnglesForUser, listActiveAnglesForUser } from "@/lib/services/angleService";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { entriesOfPost, writePost, writeSlotVersion } from "@/lib/services/postPairService";
import { generateCategoriesForUser, listActiveCategoriesForUser } from "@/lib/services/categoryLabelsService";
import { LOGIN_LINK_TTL_HOURS, issueLoginLink } from "@/lib/services/loginLinkService";
import { readEventsInBackground } from "@/lib/services/materialEventService";
import { refreshStaleReaderPortraits } from "@/lib/services/readerPortraitService";
import { ensureReaderForSeries } from "@/lib/services/seriesReaderService";
import { generateSeriesForUser, listActiveSeriesForUser } from "@/lib/services/seriesService";
import { syncSeriesSlots } from "@/lib/services/seriesSlotSync";
import { syncSource } from "@/lib/services/sourceConnectorService";
import { START_POST_PLATFORM } from "@/lib/services/startService";
import { ApiError } from "@/lib/api/errors";

/**
 * Génération en fond derrière /start (docs/SPEC_ENTREE_PAR_LE_REPO.md §5-§6). Chaque étape est
 * rejouable sans dégât : `start_jobs.stage` dit où l'on en est, un redémarrage du serveur ou un
 * second clic ne refait que ce qui manque.
 */

type Stage = typeof startJobs.$inferSelect["stage"];

/** Une génération à la fois par compte dans ce processus (un seul conteneur, comme la lecture des événements). */
const running = new Set<string>();

async function setStage(userId: string, stage: Stage, error: string | null = null) {
  await db.update(startJobs).set({ stage, error }).where(eq(startJobs.userId, userId));
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Les créneaux à venir de la série devlog sur le réseau du mail, sans post, dans l'ordre. */
async function openDevlogSlots(userId: string, seriesId: string) {
  return db.query.calendarEntries.findMany({
    where: and(
      eq(calendarEntries.userId, userId),
      eq(calendarEntries.seriesId, seriesId),
      eq(calendarEntries.platform, START_POST_PLATFORM),
      gte(calendarEntries.scheduledDate, todayUtc()),
      isNull(calendarEntries.scriptId)
    ),
    orderBy: asc(calendarEntries.scheduledDate),
  });
}

/** Lit le repo, fait le portrait des lecteurs et lit la ligne de temps : la matière dont tout le reste dépend. */
async function prepareMaterial(userId: string) {
  const source = await db.query.materialSources.findFirst({ where: eq(materialSources.userId, userId) });
  if (!source) throw new Error("The repository source is missing.");
  try {
    await syncSource(userId, source.id);
  } catch (error) {
    // Quota GitHub atteint ou panne en cours de lecture : ce qui est déjà ingéré suffit pour écrire, on ne
    // perd pas le parcours pour autant. Sans aucun document, il n'y a rien à raconter : l'échec remonte.
    const ingested = await db.query.sourceMaterials.findFirst({ where: eq(sourceMaterials.sourceId, source.id), columns: { id: true } });
    if (!ingested) throw error;
    logger.warn("Repository sync incomplete, continuing with what was ingested", { userId, error: error instanceof Error ? error.message : String(error) });
  }
  await refreshStaleReaderPortraits(userId);
  // Attendue ici (et non en arrière-plan) : le premier post raconte un événement de cette ligne de temps.
  await readEventsInBackground(userId, source.productId);
}

/** Rôles, angles, séries — la première est le devlog, qui porte les trois jours. */
async function prepareSeries(userId: string): Promise<string> {
  if ((await listActiveCategoriesForUser(userId)).length === 0) await generateCategoriesForUser(userId);
  if ((await listActiveAnglesForUser(userId)).length === 0) await generateAnglesForUser(userId);
  if ((await listActiveSeriesForUser(userId)).length === 0) await generateSeriesForUser(userId, { leadWithDevlog: true });

  const series = await listActiveSeriesForUser(userId);
  const devlog = series[0];
  if (!devlog) throw new ApiError(502, "No series could be created from this repository.");

  // Trois jours, trois posts : la série devlog les prend tous ; les autres séries proposées existent
  // mais sans rythme, la personne les allume dans Direction.
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { publishingDays: true } });
  await db
    .update(contentSeries)
    .set({ rhythm: { days: profile?.publishingDays ?? [3, 5, 6], every: 1, anchor: null } })
    .where(eq(contentSeries.id, devlog.id));
  for (const other of series.slice(1)) {
    await db.update(contentSeries).set({ rhythm: null }).where(eq(contentSeries.id, other.id));
  }
  await syncSeriesSlots(userId);
  await ensureReaderForSeries(userId, devlog.id);
  return devlog.id;
}

function postText(script: { caption: string | null; hookText: string | null; hashtags: string[] | null }): string {
  const body = (script.caption ?? script.hookText ?? "").trim();
  const tags = (script.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return tags ? `${body}\n\n${tags}` : body;
}

async function sendMail(userId: string, message: "post" | "no-post", scriptId: string | null) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } });
  if (!user) return;
  const loginUrl = await issueLoginLink(userId);
  if (message === "post" && scriptId) {
    const [script, product] = await Promise.all([
      db.query.scripts.findFirst({ where: eq(scripts.id, scriptId), columns: { caption: true, hookText: true, hashtags: true } }),
      db.query.products.findFirst({ where: eq(products.userId, userId), columns: { name: true } }),
    ]);
    if (script) {
      await sendEmail({
        to: user.email,
        ...firstPostEmail({ productName: product?.name ?? "your product", postText: postText(script), loginUrl, expiresInHours: LOGIN_LINK_TTL_HOURS }),
      });
      return;
    }
  }
  await sendEmail({ to: user.email, ...loginLinkEmail({ loginUrl, expiresInHours: LOGIN_LINK_TTL_HOURS, fresh: true }) });
}

/**
 * Tout ce qui suit la saisie de l'email : matière, séries, premier post, puis le mail. Un échec, quel
 * qu'il soit, envoie quand même le mail sans post : la personne n'attend jamais dans le vide.
 */
export async function runStartJob(userId: string): Promise<void> {
  if (running.has(userId)) return;
  running.add(userId);
  try {
    const job = await db.query.startJobs.findFirst({ where: eq(startJobs.userId, userId) });
    if (!job || job.stage === "mailed") return;

    let scriptId: string | null = null;
    try {
      await setStage(userId, "profile");
      await prepareMaterial(userId);
      await setStage(userId, "series");
      const seriesId = await prepareSeries(userId);
      await setStage(userId, "post");
      // Rejouable : un post déjà écrit pour cette série est repris tel quel, jamais réécrit.
      const done = await db.query.calendarEntries.findFirst({
        where: and(
          eq(calendarEntries.userId, userId),
          eq(calendarEntries.seriesId, seriesId),
          eq(calendarEntries.platform, START_POST_PLATFORM),
          isNotNull(calendarEntries.scriptId)
        ),
        columns: { scriptId: true },
        orderBy: asc(calendarEntries.scheduledDate),
      });
      scriptId = done?.scriptId ?? null;
      if (!scriptId) {
        const [slot] = await openDevlogSlots(userId, seriesId);
        if (!slot) throw new ApiError(502, "No slot is open for the first post.");
        // Le mail ne porte que la version LinkedIn : X s'écrit après son départ (plus bas).
        await enforceScriptQuota(userId, { date: slot.scheduledDate });
        scriptId = (await writeSlotVersion(userId, slot)).id;
      }
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : llmFailureMessage(error);
      logger.error("Start generation failed", error, { userId });
      await setStage(userId, "failed", reason).catch(() => undefined);
    }

    try {
      await sendMail(userId, scriptId ? "post" : "no-post", scriptId);
      await db.update(startJobs).set({ ...(scriptId ? { stage: "mailed" as const } : {}), mailedAt: new Date() }).where(eq(startJobs.userId, userId));
      if (scriptId) await writeSecondNetwork(userId, scriptId);
    } catch (error) {
      logger.error("Start email could not be sent", error, { userId });
      await db.update(startJobs).set({ stage: "failed", error: "The email could not be sent." }).where(eq(startJobs.userId, userId));
    }
  } finally {
    running.delete(userId);
  }
}

/** Un lien d'email a été consommé : renvoie le travail déjà demandé, ou le lance pour la première fois. */
export async function requestOtherPosts(userId: string): Promise<boolean> {
  const job = await db.query.startJobs.findFirst({ where: eq(startJobs.userId, userId) });
  // Seulement après un premier post envoyé : un compte dont la génération a échoué n'a pas de série à continuer.
  if (!job || job.stage !== "mailed" || job.otherPostsRequestedAt) return false;

  const series = (await listActiveSeriesForUser(userId))[0];
  if (!series) return false;
  const slots = (await openDevlogSlots(userId, series.id)).slice(0, 2);
  if (slots.length === 0) return false;
  // Les deux réseaux de chaque post chargent ensemble.
  for (const slot of slots) {
    for (const version of await entriesOfPost(userId, slot)) {
      if (!version.scriptId) await db.update(calendarEntries).set({ status: "generating" }).where(eq(calendarEntries.id, version.id));
    }
  }

  // La demande n'est gravée qu'une fois les créneaux marqués : sinon un échec entre les deux la
  // consommerait sans rien lancer. Une seule requête la gagne ; l'autre remet ce qu'elle a marqué.
  const [claimed] = await db
    .update(startJobs)
    .set({ otherPostsRequestedAt: new Date() })
    .where(and(eq(startJobs.userId, userId), isNull(startJobs.otherPostsRequestedAt)))
    .returning({ userId: startJobs.userId });
  return Boolean(claimed);
}

const STALLED_AFTER_MINUTES = 5;

/**
 * Une génération que le serveur a perdue en redémarrant (aucun mail parti, plus de cinq minutes) : le
 * même email resaisi, ou un lien redemandé, la relance. Vrai si elle l'a fait — c'est alors elle qui
 * enverra le mail.
 */
export async function resumeStalledJob(userId: string): Promise<boolean> {
  const job = await db.query.startJobs.findFirst({ where: eq(startJobs.userId, userId) });
  if (!job || job.mailedAt || job.stage === "mailed") return false;
  if (Date.now() - job.createdAt.getTime() < STALLED_AFTER_MINUTES * 60 * 1000) return false;
  await runStartJob(userId);
  return true;
}

/** La version X du premier post, après le départ du mail. Un échec n'est pas grave : elle se réécrit depuis l'écran. */
async function writeSecondNetwork(userId: string, scriptId: string) {
  try {
    const entry = await db.query.calendarEntries.findFirst({ where: and(eq(calendarEntries.userId, userId), eq(calendarEntries.scriptId, scriptId)) });
    if (entry) await writePost(userId, entry);
  } catch (error) {
    logger.error("The second network version of the first post could not be written", error, { userId, scriptId });
  }
}

/**
 * Écrit les posts « en chargement », l'un après l'autre (le même événement ne doit pas être choisi deux
 * fois), les deux réseaux de chacun.
 */
export async function generateOtherPosts(userId: string): Promise<void> {
  if (running.has(`other:${userId}`)) return;
  running.add(`other:${userId}`);
  try {
    // On relit la liste à chaque tour : une demande arrivée pendant l'écriture est prise au passage.
    for (;;) {
      const [slot] = await db.query.calendarEntries.findMany({
        where: and(eq(calendarEntries.userId, userId), eq(calendarEntries.status, "generating"), isNull(calendarEntries.scriptId)),
        orderBy: asc(calendarEntries.scheduledDate),
        limit: 1,
      });
      if (!slot) break;
      try {
        await writePost(userId, slot);
      } catch (error) {
        logger.error("Generation of a post of the week failed", error, { userId, entryId: slot.id });
      }
      // Ce qui n'a pas pu s'écrire cesse de charger : le créneau reste vide et se réécrit depuis l'écran.
      for (const version of await entriesOfPost(userId, slot)) {
        if (!version.scriptId) await db.update(calendarEntries).set({ status: "planned" }).where(and(eq(calendarEntries.id, version.id), eq(calendarEntries.status, "generating")));
      }
    }
  } finally {
    running.delete(`other:${userId}`);
  }
}

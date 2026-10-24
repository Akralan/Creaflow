import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, scripts } from "@/db/schema";
import { generateScript } from "@/lib/llm/generateScript";
import { defaultContentTypeForPlatform } from "@/lib/llm/prompts";
import { enforceScriptQuota } from "@/lib/services/billingService";
import { buildGenerationContext, createScriptRecord, deleteScriptForUser } from "@/lib/services/scriptService";

import { logger } from "@/lib/logger";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

/**
 * Un post, deux réseaux (docs/SPEC_APP_DESIGN_TELLOVO.md E2) : un script par réseau, rattachés au même
 * créneau — la même série, le même jour. Les deux textes racontent le même événement de la ligne de
 * temps, chacun avec les règles de son réseau.
 */

export type SlotEntry = typeof calendarEntries.$inferSelect;

/** LinkedIn d'abord : c'est la version du premier mail ; X reprend l'événement de LinkedIn. */
const PLATFORM_ORDER = KNOWN_PLATFORMS.map((p) => p.key);

function platformRank(platform: string): number {
  const i = PLATFORM_ORDER.indexOf(platform);
  return i === -1 ? PLATFORM_ORDER.length : i;
}

/** Les créneaux d'un même post : même série, même jour, tous réseaux, LinkedIn en tête. */
export async function entriesOfPost(userId: string, entry: Pick<SlotEntry, "seriesId" | "scheduledDate" | "id">): Promise<SlotEntry[]> {
  if (!entry.seriesId) {
    const alone = await db.query.calendarEntries.findFirst({ where: and(eq(calendarEntries.id, entry.id), eq(calendarEntries.userId, userId)) });
    return alone ? [alone] : [];
  }
  const rows = await db.query.calendarEntries.findMany({
    where: and(eq(calendarEntries.userId, userId), eq(calendarEntries.seriesId, entry.seriesId), eq(calendarEntries.scheduledDate, entry.scheduledDate)),
    orderBy: asc(calendarEntries.platform),
  });
  return rows.filter((r) => PLATFORM_ORDER.includes(r.platform)).sort((a, b) => platformRank(a.platform) - platformRank(b.platform));
}

/**
 * Écrit la version d'un créneau par le chemin de génération ordinaire (même contexte que
 * `POST /api/scripts/generate`). `sameEventId` impose l'événement d'une version déjà écrite.
 * Ne vérifie pas le quota : l'appelant le fait une fois pour tout le post.
 */
export async function writeSlotVersion(userId: string, entry: SlotEntry, samePointerIds: string[] = []) {
  const contentType = defaultContentTypeForPlatform(entry.platform);
  const context = await buildGenerationContext(userId, entry.platform, entry.contentCategoryId, contentType, null, undefined, entry.seriesId, undefined, undefined, undefined, null, samePointerIds);
  const generated = await generateScript(context);
  const script = await createScriptRecord(userId, entry.platform, context.contentCategory, context.resolvedProductId ?? null, generated, {
    angleId: context.angle?.id ?? null,
    seriesId: context.series?.id ?? null,
    brandAssetId: context.brandAsset?.id ?? null,
    // Le post marque TOUS les pointeurs dont il est parti (docs/SPEC_EVENEMENT_POINTEUR.md §4) ;
    // `eventId` garde le premier pour les écrans et requêtes qui le lisent déjà.
    eventId: generated.eventIds?.[0] ?? null,
    eventIds: generated.eventIds ?? [],
    visual: context.visual,
  });
  try {
    await db
      .update(calendarEntries)
      .set({ scriptId: script.id, status: "planned", kind: "event" })
      .where(eq(calendarEntries.id, entry.id));
  } catch (error) {
    // Un script sans créneau serait réécrit au prochain essai : on le retire.
    await deleteScriptForUser(userId, script.id).catch(() => undefined);
    throw error;
  }
  return script;
}

/** Les pointeurs racontés par une version déjà écrite du post, s'il y en a une. */
async function pointersOfWrittenVersion(userId: string, entries: SlotEntry[]): Promise<string[]> {
  for (const e of entries) {
    if (!e.scriptId) continue;
    const script = await db.query.scripts.findFirst({
      where: and(eq(scripts.id, e.scriptId), eq(scripts.userId, userId)),
      columns: { eventId: true, eventIds: true },
    });
    const ids = Array.isArray(script?.eventIds) ? (script.eventIds as string[]) : [];
    if (ids.length > 0) return ids;
    if (script?.eventId) return [script.eventId];
  }
  return [];
}

/**
 * Écrit les versions manquantes d'un post, l'une après l'autre. Rejouable : une version déjà écrite est
 * gardée, et les manquantes reprennent son événement. Une version qui échoue n'empêche pas l'autre et
 * remet son créneau à « planned » ; l'erreur est relancée à la fin.
 */
export async function writePost(
  userId: string,
  entry: SlotEntry,
  hooks?: { onVersionWritten?: (script: Awaited<ReturnType<typeof writeSlotVersion>>, entry: SlotEntry) => Promise<void> }
): Promise<void> {
  const entries = await entriesOfPost(userId, entry);
  const missing = entries.filter((e) => !e.scriptId);
  if (missing.length === 0) return;
  if (missing.length === entries.length) await enforceScriptQuota(userId, { date: entry.scheduledDate });

  let pointerIds = await pointersOfWrittenVersion(userId, entries);
  let firstError: unknown = null;
  for (const slot of missing) {
    try {
      // Un essai de plus quand le rédacteur n'a rien soumis : il lui arrive de conclure en prose
      // au lieu d'appeler son outil, et un post ne doit pas se perdre pour un caprice de modèle.
      const script = await writeSlotVersion(userId, slot, pointerIds).catch(async (error) => {
        if (!(error instanceof Error) || !error.message.includes("submitted no post")) throw error;
        logger.warn("Writer submitted nothing, one more try", { slotId: slot.id, reason: error.message.slice(0, 200) });
        return writeSlotVersion(userId, slot, pointerIds);
      });
      // La première version écrite fixe les pointeurs ; les suivantes les reprennent.
      if (pointerIds.length === 0) {
        const written = Array.isArray(script.eventIds) ? (script.eventIds as string[]) : [];
        pointerIds = written.length > 0 ? written : script.eventId ? [script.eventId] : [];
      }
      await hooks?.onVersionWritten?.(script, slot);
    } catch (error) {
      firstError = firstError ?? error;
      await db.update(calendarEntries).set({ status: "planned" }).where(and(eq(calendarEntries.id, slot.id), isNull(calendarEntries.scriptId)));
      // Sans version écrite, il n'y a pas de pointeur à reprendre : on s'arrête là plutôt que
      // d'en brûler un second sur une autre matière.
      if (pointerIds.length === 0) break;
    }
  }
  if (firstError) throw firstError;
}

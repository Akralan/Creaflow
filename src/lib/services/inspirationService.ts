import { and, asc, desc, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { inspirations, postingGoals, products } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { researchInspirations } from "@/lib/llm/inspirationResearch";
import { parseStoredReaderPortrait } from "@/lib/llm/readerPortrait";
import type { InspirationCard } from "@/lib/llm/prompts";
import type { GenerationTrace } from "@/lib/llm/scriptSchema";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

/**
 * Veille d'inspiration par sujet (docs/SPEC_MEMOIRE_ET_VEILLE.md §3). Produite hors requête par les
 * routes via after() quand elle est automatique — aucun service n'importe next/server.
 */

export const MAX_ACTIVE_INSPIRATIONS = 10;
/** Un seul post ne retire pas une fiche : le modèle confond « pas pour ce post » et « jamais pour ce
 *  sujet » (observé en réel : 4 à 5 fiches sur 8 signalées d'un coup, raisons propres au post). Il
 *  faut ce nombre de générations qui la signalent, sans qu'elle serve entre-temps. */
export const DROP_VOTES_TO_DISMISS = 2;
/** Montrée autant de fois sans jamais servir : la fiche sort d'elle-même. */
export const MAX_SHOWN_UNUSED = 8;
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

async function ownedProduct(userId: string, productId: string) {
  const product = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.userId, userId)) });
  if (!product) throw new ApiError(404, "Subject not found.");
  return product;
}

export async function listInspirations(userId: string, productId: string) {
  const product = await ownedProduct(userId, productId);
  const list = await db.query.inspirations.findMany({
    where: and(eq(inspirations.userId, userId), eq(inspirations.productId, productId)),
    orderBy: [asc(inspirations.status), desc(inspirations.createdAt)],
  });
  return { inspirations: list, refreshedAt: product.inspirationRefreshedAt };
}

/** Au-delà du plafond, écarte les plus anciennes — d'abord celles qui n'ont jamais servi. */
async function enforceActiveCap(userId: string, productId: string): Promise<void> {
  const active = await db.query.inspirations.findMany({
    where: and(eq(inspirations.userId, userId), eq(inspirations.productId, productId), eq(inspirations.status, "active")),
    orderBy: [asc(inspirations.usedCount), asc(inspirations.createdAt)],
  });
  const excess = active.length - MAX_ACTIVE_INSPIRATIONS;
  if (excess <= 0) return;
  await db
    .update(inspirations)
    .set({ status: "dismissed", dismissedBy: "system", dismissReason: "Replaced by a more recent finding.", updatedAt: new Date() })
    .where(inArray(inspirations.id, active.slice(0, excess).map((i) => i.id)));
}

/** Lance une veille pour un sujet (bouton « Lancer une veille », ou relance automatique). */
export async function runInspirationResearch(userId: string, productId: string) {
  const product = await ownedProduct(userId, productId);
  const [existing, goals] = await Promise.all([
    db.query.inspirations.findMany({ where: and(eq(inspirations.userId, userId), eq(inspirations.productId, productId)) }),
    db.query.postingGoals.findMany({ where: and(eq(postingGoals.userId, userId), gt(postingGoals.targetCountPerWeek, 0)) }),
  ]);
  const readers = parseStoredReaderPortrait(product.readerPortrait)?.readers ?? [];
  const found = await researchInspirations(
    {
      subjectName: product.name,
      subjectDescription: product.description,
      readers: readers.map((r) => ({ label: r.label, who: r.who, wants: r.wants })),
      targetAudience: product.targetAudience,
      platforms: goals.map((g) => g.platform),
      existingUrls: existing.filter((i) => i.status === "active").map((i) => i.url),
      dismissed: existing.filter((i) => i.status === "dismissed").map((i) => ({ url: i.url, reason: i.dismissReason })),
    },
    KNOWN_PLATFORMS.map((p) => p.key)
  );
  if (found.length > 0) {
    await db.insert(inspirations).values(found.map((f) => ({ userId, productId, ...f })));
    await enforceActiveCap(userId, productId);
  }
  // Posée même sans trouvaille : sinon chaque génération relancerait une veille qui ne trouve rien.
  await db.update(products).set({ inspirationRefreshedAt: new Date() }).where(eq(products.id, productId));
  return listInspirations(userId, productId);
}

/** Relance automatique après une génération, si la dernière veille du sujet a plus de 7 jours. */
export async function refreshInspirationsIfStale(userId: string, productId: string | null): Promise<void> {
  if (!productId || process.env.INSPIRATION_AUTO_REFRESH === "false" || !process.env.OPENAI_API_KEY) return;
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.userId, userId)),
    columns: { inspirationRefreshedAt: true },
  });
  if (!product) return;
  const last = product.inspirationRefreshedAt?.getTime() ?? 0;
  if (Date.now() - last < REFRESH_AFTER_MS) return;
  // Pose la date avant l'appel : deux générations rapprochées ne lancent pas deux veilles.
  await db.update(products).set({ inspirationRefreshedAt: new Date() }).where(eq(products.id, productId));
  try {
    await runInspirationResearch(userId, productId);
  } catch (err) {
    logger.error("Automatic inspiration watch failed", err, { productId });
  }
}

export async function setInspirationStatus(userId: string, id: string, status: "active" | "dismissed") {
  const [updated] = await db
    .update(inspirations)
    .set(
      status === "active"
        ? { status, dismissedBy: null, dismissReason: null, shownCount: 0, dropVotes: 0, updatedAt: new Date() }
        : { status, dismissedBy: "user", dismissReason: "Dismissed by hand.", updatedAt: new Date() }
    )
    .where(and(eq(inspirations.id, id), eq(inspirations.userId, userId)))
    .returning();
  if (!updated) throw new ApiError(404, "Card not found.");
  if (status === "active") await enforceActiveCap(userId, updated.productId);
  return updated;
}

export async function deleteInspiration(userId: string, id: string): Promise<void> {
  const [deleted] = await db
    .delete(inspirations)
    .where(and(eq(inspirations.id, id), eq(inspirations.userId, userId)))
    .returning({ id: inspirations.id });
  if (!deleted) throw new ApiError(404, "Card not found.");
}

/** Fiches actives injectées dans le prompt, numérotées i1…i10 pour le modèle (§3.3). */
export async function loadInspirationsForGeneration(userId: string, productId: string | null): Promise<InspirationCard[]> {
  if (!productId) return [];
  const list = await db.query.inspirations.findMany({
    where: and(eq(inspirations.userId, userId), eq(inspirations.productId, productId), eq(inspirations.status, "active")),
    orderBy: [desc(inspirations.usedCount), desc(inspirations.createdAt)],
    limit: MAX_ACTIVE_INSPIRATIONS,
  });
  return list.map((i, index) => ({
    ref: `i${index + 1}`,
    id: i.id,
    url: i.url,
    insight: i.insight,
    kind: i.kind,
    readerLabel: i.readerLabel,
    platform: i.platform,
  }));
}

/**
 * Après l'enregistrement d'un script (§3.3) : montrées +1, utiles +1, écartées par le rédacteur, et
 * celles montrées trop souvent sans servir sortent d'elles-mêmes. Une référence inconnue est ignorée.
 */
export async function applyInspirationFeedback(userId: string, trace: GenerationTrace | undefined): Promise<void> {
  const shown = trace?.inspirationsShown ?? [];
  if (shown.length === 0) return;
  const idOf = new Map(shown.map((s) => [s.ref, s.id]));
  const shownIds = shown.map((s) => s.id);
  const usedIds = (trace?.inspirationsUsed ?? []).map((ref) => idOf.get(ref)).filter((id): id is string => Boolean(id));
  const now = new Date();
  await db
    .update(inspirations)
    .set({ shownCount: sql`${inspirations.shownCount} + 1`, updatedAt: now })
    .where(and(eq(inspirations.userId, userId), inArray(inspirations.id, shownIds)));
  if (usedIds.length > 0) {
    await db
      .update(inspirations)
      // Une fiche qui sert efface les signalements passés.
      .set({ usedCount: sql`${inspirations.usedCount} + 1`, dropVotes: 0 })
      .where(and(eq(inspirations.userId, userId), inArray(inspirations.id, usedIds)));
  }
  for (const drop of trace?.inspirationsToDrop ?? []) {
    const id = idOf.get(drop.ref);
    if (!id || usedIds.includes(id)) continue;
    const votes = sql`${inspirations.dropVotes} + 1`;
    await db
      .update(inspirations)
      .set({
        dropVotes: votes,
        // La raison du dernier signalement : c'est elle qu'on affiche si la fiche finit écartée.
        dismissReason: drop.why || "Flagged as useless by the writer.",
        status: sql`case when ${votes} >= ${DROP_VOTES_TO_DISMISS} then 'dismissed'::inspiration_status else ${inspirations.status} end`,
        dismissedBy: sql`case when ${votes} >= ${DROP_VOTES_TO_DISMISS} then 'model' else ${inspirations.dismissedBy} end`,
        updatedAt: now,
      })
      .where(and(eq(inspirations.id, id), eq(inspirations.userId, userId), eq(inspirations.status, "active")));
  }
  await db
    .update(inspirations)
    .set({ status: "dismissed", dismissedBy: "system", dismissReason: `Shown ${MAX_SHOWN_UNUSED} times without ever being used.`, updatedAt: now })
    .where(
      and(
        eq(inspirations.userId, userId),
        inArray(inspirations.id, shownIds),
        eq(inspirations.status, "active"),
        eq(inspirations.usedCount, 0),
        gte(inspirations.shownCount, MAX_SHOWN_UNUSED)
      )
    );
}

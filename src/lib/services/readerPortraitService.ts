import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { creatorProfiles, postingGoals, products, sourceMaterials } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { scheduleEventQualification } from "@/lib/services/materialEventService";
import {
  describeReaders,
  MAX_PORTRAIT_SUMMARIES,
  parseStoredReaderPortrait,
  portraitIsStale,
  readerSchema,
  type Reader,
  type ReaderPortrait,
} from "@/lib/llm/readerPortrait";

/**
 * Portrait des lecteurs par sujet (docs/SPEC_PROMPT_GENERATION_V3.md §2.2). Produit hors requête
 * par les routes via after() — même convention que les résumés de matière : aucun service
 * n'importe next/server.
 */

type ProductRow = typeof products.$inferSelect;

async function buildPortrait(userId: string, product: ProductRow): Promise<ReaderPortrait> {
  const [profile, goals, materials] = await Promise.all([
    db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) }),
    db.query.postingGoals.findMany({ where: and(eq(postingGoals.userId, userId), gt(postingGoals.targetCountPerWeek, 0)) }),
    db.query.sourceMaterials.findMany({
      where: and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, product.id)),
      columns: { title: true, summary: true },
      limit: MAX_PORTRAIT_SUMMARIES,
    }),
  ]);
  // Les résumés n'existent pas forcément encore (ils naissent paresseusement) : le titre du
  // document en tient lieu plutôt que de lancer un résumé par document ici.
  const materialSummaries = materials
    .map((m) => m.summary ?? (m.title ? `Document "${m.title}"` : null))
    .filter((s): s is string => Boolean(s));
  return describeReaders({
    subjectName: product.name,
    subjectDescription: product.description,
    valueProposition: product.valueProposition,
    subjectAudience: product.targetAudience,
    brandAudience: profile?.targetAudience ?? null,
    activityType: profile?.activityType ?? "",
    platforms: goals.map((g) => g.platform),
    materialSummaries,
  });
}

/** Refait le portrait d'un sujet, même corrigé à la main (bouton « Refaire le portrait »). */
export async function regenerateReaderPortrait(userId: string, productId: string): Promise<ReaderPortrait> {
  const product = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.userId, userId)) });
  if (!product) throw new ApiError(404, "Subject not found.");
  const portrait = await buildPortrait(userId, product);
  await db.update(products).set({ readerPortrait: portrait }).where(eq(products.id, product.id));
  scheduleEventQualification(userId, product.id);
  return portrait;
}

/**
 * Refait les portraits manquants ou périmés, un sujet à la fois. Seul déclencheur automatique :
 * appelé après la fin de l'onboarding (tous les sujets), la création ou la modification d'un sujet
 * et l'acceptation d'une proposition de sujet (les sujets touchés seulement — un portrait en échec
 * ailleurs n'est pas retenté à chaque geste). Jamais bloquant.
 */
export async function refreshStaleReaderPortraits(userId: string, productIds?: string[]): Promise<void> {
  if (productIds && productIds.length === 0) return;
  const list = await db.query.products.findMany({
    where: and(eq(products.userId, userId), productIds ? inArray(products.id, productIds) : undefined),
  });
  for (const product of list.filter(portraitIsStale)) {
    try {
      const portrait = await buildPortrait(userId, product);
      // Écrit seulement si personne n'a corrigé le portrait à la main pendant l'appel LLM, et si le
      // « Pour qui » n'a pas rechangé entre-temps (un rafraîchissement plus récent s'en charge).
      await db
        .update(products)
        .set({ readerPortrait: portrait })
        .where(
          and(
            eq(products.id, product.id),
            sql`coalesce((${products.readerPortrait}->>'editedByUser')::boolean, false) = false`,
            product.targetAudience === null ? isNull(products.targetAudience) : eq(products.targetAudience, product.targetAudience)
          )
        );
      // Les événements déjà lus reçoivent leur public (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3).
      scheduleEventQualification(userId, product.id);
    } catch (err) {
      logger.error("Reader portrait failed", err, { productId: product.id });
    }
  }
}

export const readerPortraitEditSchema = z.object({
  readers: z.array(readerSchema).min(1).max(3),
});

/** Correction à la main : le portrait n'est plus remplacé automatiquement. */
export async function saveReaderPortrait(userId: string, productId: string, readers: Reader[]): Promise<ReaderPortrait> {
  const product = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.userId, userId)) });
  if (!product) throw new ApiError(404, "Subject not found.");
  const previous = parseStoredReaderPortrait(product.readerPortrait);
  const portrait: ReaderPortrait = {
    readers,
    generatedAt: previous?.generatedAt ?? null,
    editedByUser: true,
    basedOnAudience: product.targetAudience || null,
  };
  await db.update(products).set({ readerPortrait: portrait }).where(eq(products.id, product.id));
  scheduleEventQualification(userId, product.id);
  return portrait;
}

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, contentSeriesCategories, contentSeriesPlatforms, creatorProfiles, products } from "@/db/schema";
import { suggestContentSeries } from "@/lib/llm/seriesLabels";
import { listActiveCategoriesForUser, resolveCategoryLabelToId } from "@/lib/services/categoryLabelsService";
import { syncSeriesSlots } from "@/lib/services/seriesSlotSync";
import { distributeDays, parseStoredRhythm, type SeriesRhythm } from "@/lib/seriesRhythm";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Écran Direction — endpoint agrégé (docs/SPEC_REDACTEUR_EN_CHEF.md §6 : "pas de nouvel endpoint de
 *  lecture, étendre l'endpoint agrégé existant") : chaque série porte son état narratif le cas
 *
 *  Une série porte exactement UN rôle (docs/SPEC_SERIES_ET_ROLES.md §1) — la jonction
 *  contentSeriesCategories est conservée physiquement, l'invariant est imposé ici et dans
 *  upsertSeriesItem. `category` est le premier lien trouvé ; une série sans lien (données
 *  antérieures à la migration) remonte `category: null` et est ignorée par le calendrier. */
export async function listActiveSeriesForUser(userId: string) {
  const rows = await db.query.contentSeries.findMany({
    where: and(eq(contentSeries.userId, userId), eq(contentSeries.archived, false)),
    orderBy: (s, { desc }) => [desc(s.weight)],
    with: {
      contentSeriesCategories: { with: { category: { columns: { id: true, label: true } } } },
      contentSeriesPlatforms: { columns: { platform: true } },
      // Sujet lié (sélecteur de sujet, docs/SPEC_REDACTEUR_EN_CHEF.md) — pour affichage et édition
      // côté écran Direction ; `null` si la série n'est rattachée à aucun sujet précis.
      product: { columns: { id: true, name: true } },
    },
  });
  return rows.map(({ contentSeriesCategories: joins, contentSeriesPlatforms: platformJoins, ...s }) => ({
    ...s,
    category: joins[0]?.category ?? null,
    platforms: platformJoins.map((j) => j.platform),
    rhythm: parseStoredRhythm(s.rhythm),
  }));
}

/** Rôle porté par une série (docs/SPEC_SERIES_ET_ROLES.md §4.2) — `null` si la série n'existe pas
 *  pour cet utilisateur. Sert à dériver le rôle d'un créneau ou d'un script à partir de sa série
 *  au lieu de le demander à l'appelant. */
export async function findSeriesCategoryId(userId: string, seriesId: string): Promise<string | null> {
  const found = await db.query.contentSeries.findFirst({
    where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)),
    columns: { id: true },
    with: { contentSeriesCategories: { columns: { categoryId: true }, limit: 1 } },
  });
  return found?.contentSeriesCategories[0]?.categoryId ?? null;
}

/**
 * Résolution du rôle pour toute porte de génération/import/édition de créneau
 * (docs/SPEC_SERIES_ET_ROLES.md §4.2) : la série impose son rôle ; sans série, le rôle doit être
 * fourni explicitement (post libre). Un `contentCategoryId` contradictoire avec la série est ignoré
 * et journalisé plutôt que refusé — le client d'avant le recadrage envoyait toujours les deux.
 */
export async function resolveCategoryForGeneration(
  userId: string,
  input: { seriesId?: string | null; contentCategoryId?: string | null }
): Promise<string> {
  if (input.seriesId) {
    const seriesCategoryId = await findSeriesCategoryId(userId, input.seriesId);
    if (!seriesCategoryId) {
      throw new ApiError(404, "Série introuvable ou sans rôle.");
    }
    if (input.contentCategoryId && input.contentCategoryId !== seriesCategoryId) {
      logger.warn("Rôle contradictoire avec la série, rôle de la série retenu", {
        seriesId: input.seriesId,
        requested: input.contentCategoryId,
        resolved: seriesCategoryId,
      });
    }
    return seriesCategoryId;
  }
  if (!input.contentCategoryId) {
    throw new ApiError(400, "Un post libre doit avoir un rôle (contentCategoryId).");
  }
  return input.contentCategoryId;
}

/** Changement du sujet lié d'une série (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §4) : le lecteur se
 *  choisit ensuite dans le portrait du nouveau sujet. */
export async function updateSeriesFields(userId: string, seriesId: string, fields: { productId?: string | null }) {
  if (fields.productId) {
    const product = await db.query.products.findFirst({ where: and(eq(products.id, fields.productId), eq(products.userId, userId)) });
    if (!product) {
      throw new ApiError(404, "Sujet introuvable.");
    }
  }
  const [updated] = await db
    .update(contentSeries)
    .set({
      ...(fields.productId !== undefined && { productId: fields.productId }),
    })
    .where(and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)))
    .returning();
  if (!updated) {
    throw new ApiError(404, "Série introuvable.");
  }
  return updated;
}

/** Archivage d'UNE série (docs/SPEC_ASSISTANT_AGENTIQUE.md §4.1) — l'archivage par omission de
 *  saveSeriesForUser suppose de renvoyer la liste entière, ce qu'une proposition ciblée n'a pas.
 *  Jamais de suppression : les scripts et créneaux déjà produits gardent leur référence. */
export async function archiveSeriesForUser(userId: string, seriesId: string) {
  const [archived] = await db
    .update(contentSeries)
    .set({ archived: true })
    .where(and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)))
    .returning();
  if (!archived) {
    throw new ApiError(404, "Série introuvable.");
  }
  await syncSeriesSlots(userId);
  return archived;
}

/** Sélection de fin d'onboarding : archive toutes les séries actives SAUF celles listées.
 *  Refuse un id inconnu ou déjà archivé plutôt que de l'ignorer — un décalage entre ce que
 *  l'utilisateur a vu et ce que le serveur connaît doit se voir, pas s'absorber. */
export async function keepOnlySeries(userId: string, keptIds: string[]) {
  const active = await listActiveSeriesForUser(userId);
  const activeIds = new Set(active.map((s) => s.id));
  if (!keptIds.every((id) => activeIds.has(id))) {
    throw new ApiError(404, "Série introuvable.");
  }
  const toArchive = active.filter((s) => !keptIds.includes(s.id)).map((s) => s.id);
  if (toArchive.length > 0) {
    await db
      .update(contentSeries)
      .set({ archived: true })
      .where(and(eq(contentSeries.userId, userId), inArray(contentSeries.id, toArchive)));
  }
  // Les jours où l'auteur peut publier, répartis entre les séries gardées de la plus lourde à la
  // plus légère (docs/SPEC_RYTHME_DES_SERIES.md §5) ; il les ajuste ensuite dans Direction. Écrase
  // volontairement les rythmes : la sélection n'a lieu qu'en sortie d'onboarding, sur des séries
  // fraîchement générées dont les jours avaient été répartis entre TOUTES les proposées.
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId), columns: { publishingDays: true } });
  const kept = active.filter((s) => keptIds.includes(s.id));
  const days = distributeDays(profile?.publishingDays ?? [], kept.length);
  for (const [i, s] of kept.entries()) {
    await db.update(contentSeries).set({ rhythm: { days: days[i], every: 1, anchor: null } }).where(eq(contentSeries.id, s.id));
  }
  await syncSeriesSlots(userId);
  return listActiveSeriesForUser(userId);
}

/** Génère un nouveau jeu de séries via l'IA à partir des catégories actives de l'utilisateur.
 *  Archive l'ancien jeu actif plutôt que de le supprimer (mêmes garanties que generateCategoriesForUser). */
export async function generateSeriesForUser(userId: string) {
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur avant de générer les séries.");
  }

  const productList = await db.query.products.findMany({ where: eq(products.userId, userId) });
  const activeCategories = await listActiveCategoriesForUser(userId);
  if (activeCategories.length === 0) {
    throw new ApiError(400, "Configure d'abord tes rôles éditoriaux avant de générer les séries.");
  }

  const suggested = await suggestContentSeries({
    brandName: profile.brandName,
    activityType: profile.activityType,
    expectations: profile.expectations,
    products: productList.map((p) => ({ name: p.name, description: p.description })),
    categories: activeCategories.map((c) => ({ label: c.label, description: c.description })),
  });

  logger.debug("Réponse brute LLM (suggestion de séries)", { suggested });

  // Résout categoryLabel -> categoryId ; ignore une série suggérée dont le rôle ne matche pas.
  // Sujet de chaque série : celui choisi par le modèle, ou d'office l'unique sujet du compte — une
  // série sans sujet n'a ni matière ni portrait des lecteurs (constaté en réel le 2026-10-17).
  const productIdFor = (subjectName: string): string | null =>
    productList.find((p) => p.name === subjectName)?.id ?? (productList.length === 1 ? productList[0].id : null);
  const resolvedAll = suggested
    .map((s) => ({ ...s, categoryId: resolveCategoryLabelToId(s.categoryLabel, activeCategories), productId: productIdFor(s.subjectName) }))
    .filter((s): s is typeof s & { categoryId: string } => s.categoryId !== null);
  // Le modèle range ses séries de la plus importante à la moins importante : le poids ne sert plus
  // qu'à cet ordre, et les jours où l'auteur peut publier sont répartis dans le même ordre
  // (docs/SPEC_RYTHME_DES_SERIES.md §2).
  const days = distributeDays(profile.publishingDays ?? [], resolvedAll.length);
  const resolved = resolvedAll.map((s, i) => ({
    ...s,
    weight: Math.max(10, 50 - i * 10),
    rhythm: { days: days[i], every: 1 as const, anchor: null },
  }));

  const generated = await db.transaction(async (tx) => {
    await tx
      .update(contentSeries)
      .set({ archived: true })
      .where(and(eq(contentSeries.userId, userId), eq(contentSeries.archived, false)));

    if (resolved.length === 0) return [];

    const inserted = await tx
      .insert(contentSeries)
      .values(resolved.map((s) => ({ userId, label: s.label, description: s.description, weight: s.weight, productId: s.productId, rhythm: s.rhythm })))
      .returning();

    await tx.insert(contentSeriesCategories).values(inserted.map((series, i) => ({ seriesId: series.id, categoryId: resolved[i].categoryId })));

    return inserted.map((s, i) => {
      const category = activeCategories.find((c) => c.id === resolved[i].categoryId)!;
      return {
        ...s,
        category: { id: category.id, label: category.label },
        // La génération IA ne propose pas de ciblage plateforme — même valeur par défaut que
        // "aucune ligne ContentSeriesPlatforms" (visible sur tous les réseaux), pour que la forme
        // renvoyée reste identique à listActiveSeriesForUser/saveSeriesForUser.
        platforms: [] as string[],
        rhythm: resolved[i].rhythm as SeriesRhythm,
        // Toujours null : ce sont des lignes fraîchement insérées, un état narratif ne peut exister
        // que pour un seriesId déjà connu.
        product: (() => {
          const product = productList.find((p) => p.id === resolved[i].productId);
          return product ? { id: product.id, name: product.name } : null;
        })(),
      };
    });
  });
  // L'ancien jeu vient d'être archivé : ses créneaux à venir sortent, le nouveau pose les siens.
  await syncSeriesSlots(userId);
  return generated;
}

interface SeriesInput {
  id?: string;
  label: string;
  description: string;
  /** Ordre d'affichage seulement depuis docs/SPEC_RYTHME_DES_SERIES.md — `undefined` le laisse
   *  inchangé (50 à la création). */
  weight?: number;
  categoryId: string;
  platforms: string[];
  /** `undefined` laisse le rythme inchangé ; null = pas de rythme (aucun créneau). */
  rhythm?: SeriesRhythm | null;
  /** Sujet dont la série tire sa matière — `undefined` laisse le rattachement inchangé.
   *  L'appelant est responsable de vérifier que le sujet appartient bien à l'utilisateur
   *  (cf. updateSeriesFields, qui le fait pour la porte d'édition directe). */
  productId?: string | null;
}

/** Insère ou met à jour UNE série et resynchronise son rôle et ses plateformes, dans la transaction fournie.
 *  Ne touche aucune autre ligne — contrairement à saveSeriesForUser, n'archive rien.
 *  Retourne null si un id est fourni mais ne correspond à aucune série de cet utilisateur. */
export async function upsertSeriesItem(tx: Tx, userId: string, item: SeriesInput): Promise<string | null> {
  let seriesId: string;
  if (item.id) {
    const [updated] = await tx
      .update(contentSeries)
      .set({
        label: item.label,
        description: item.description,
        ...(item.weight !== undefined && { weight: item.weight }),
        ...(item.rhythm !== undefined && { rhythm: item.rhythm }),
        ...(item.productId !== undefined && { productId: item.productId }),
      })
      .where(and(eq(contentSeries.id, item.id), eq(contentSeries.userId, userId)))
      .returning();
    if (!updated) return null;
    seriesId = updated.id;
    await tx.delete(contentSeriesCategories).where(eq(contentSeriesCategories.seriesId, seriesId));
    await tx.delete(contentSeriesPlatforms).where(eq(contentSeriesPlatforms.seriesId, seriesId));
  } else {
    const [inserted] = await tx
      .insert(contentSeries)
      .values({
        userId,
        label: item.label,
        description: item.description,
        weight: item.weight ?? 50,
        rhythm: item.rhythm ?? null,
        ...(item.productId !== undefined && { productId: item.productId }),
      })
      .returning();
    seriesId = inserted.id;
  }
  await tx.insert(contentSeriesCategories).values({ seriesId, categoryId: item.categoryId });
  if (item.platforms.length > 0) {
    await tx.insert(contentSeriesPlatforms).values(item.platforms.map((platform) => ({ seriesId, platform })));
  }
  return seriesId;
}

/** Enregistrement manuel : diffe contre le jeu actif (même logique que saveCategoriesForUser),
 *  et resynchronise le rôle à chaque mise à jour. Renvoie aussi ce que le recalcul du calendrier a
 *  changé par série, pour dire à l'auteur où sa série s'est remplie. */
export async function saveSeriesForUser(userId: string, items: SeriesInput[]) {
  const active = await listActiveSeriesForUser(userId);
  const keptIds = new Set(items.filter((s) => s.id).map((s) => s.id as string));

  await db.transaction(async (tx) => {
    const toArchive = active.filter((s) => !keptIds.has(s.id));
    for (const s of toArchive) {
      await tx.update(contentSeries).set({ archived: true }).where(eq(contentSeries.id, s.id));
    }

    for (const item of items) {
      await upsertSeriesItem(tx, userId, item);
    }
  });
  const slotChanges = await syncSeriesSlots(userId);

  // relit pour renvoyer la forme jointe à jour
  return { series: await listActiveSeriesForUser(userId), slotChanges: Object.fromEntries(slotChanges) };
}

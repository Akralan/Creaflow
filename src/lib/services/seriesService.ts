import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, contentSeriesCategories, contentSeriesPlatforms, creatorProfiles, products } from "@/db/schema";
import { suggestContentSeries } from "@/lib/llm/seriesLabels";
import { listActiveCategoriesForUser, resolveCategoryLabelToId } from "@/lib/services/categoryLabelsService";
import { findNarrativeStatesForSeries } from "@/lib/services/narrativeDirector";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Écran Direction — endpoint agrégé (docs/SPEC_REDACTEUR_EN_CHEF.md §6 : "pas de nouvel endpoint de
 *  lecture, étendre l'endpoint agrégé existant") : chaque série porte son état narratif le cas
 *  échéant (`null` si jamais planifiée, ou mode rendez_vous).
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
  const narrativeStates = await findNarrativeStatesForSeries(
    userId,
    rows.map((r) => r.id)
  );
  return rows.map(({ contentSeriesCategories: joins, contentSeriesPlatforms: platformJoins, ...s }) => ({
    ...s,
    category: joins[0]?.category ?? null,
    platforms: platformJoins.map((j) => j.platform),
    narrativeState: narrativeStates.get(s.id) ?? null,
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

/** Bascule de mode et/ou changement du sujet lié (docs/SPEC_REDACTEUR_EN_CHEF.md §7) — n'affecte
 *  jamais l'état narratif existant : ni la bascule de mode (rendez_vous conserve les beats, masque
 *  seulement la planification côté UI), ni le changement de sujet (l'état d'un plan déjà en cours
 *  n'est pas migré — nouvelle matière lue à la prochaine planification/génération, cf.
 *  narrativeDirector.ts::resolveSubject qui lit `ContentSeries.productId` à chaque appel, jamais
 *  une valeur figée sur NarrativeState). */
export async function updateSeriesFields(
  userId: string,
  seriesId: string,
  fields: { mode?: (typeof contentSeries.$inferInsert)["mode"]; productId?: string | null }
) {
  if (fields.productId) {
    const product = await db.query.products.findFirst({ where: and(eq(products.id, fields.productId), eq(products.userId, userId)) });
    if (!product) {
      throw new ApiError(404, "Sujet introuvable.");
    }
  }
  const [updated] = await db
    .update(contentSeries)
    .set({
      ...(fields.mode !== undefined && { mode: fields.mode }),
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
  return archived;
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
    tone: profile.tone,
    values: profile.values,
    products: productList.map((p) => ({ name: p.name, description: p.description })),
    categories: activeCategories.map((c) => ({ label: c.label, description: c.description })),
  });

  logger.debug("Réponse brute LLM (suggestion de séries)", { suggested });

  // Résout categoryLabel -> categoryId ; ignore une série suggérée dont le rôle ne matche pas.
  const resolved = suggested
    .map((s) => ({ ...s, categoryId: resolveCategoryLabelToId(s.categoryLabel, activeCategories) }))
    .filter((s): s is typeof s & { categoryId: string } => s.categoryId !== null);

  return db.transaction(async (tx) => {
    await tx
      .update(contentSeries)
      .set({ archived: true })
      .where(and(eq(contentSeries.userId, userId), eq(contentSeries.archived, false)));

    if (resolved.length === 0) return [];

    const inserted = await tx
      .insert(contentSeries)
      .values(resolved.map((s) => ({ userId, label: s.label, description: s.description, weight: s.weight, mode: s.mode })))
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
        // Toujours null : ce sont des lignes fraîchement insérées, un état narratif ne peut exister
        // que pour un seriesId déjà connu, et la génération IA ne propose pas de sujet lié.
        narrativeState: null,
        product: null,
      };
    });
  });
}

interface SeriesInput {
  id?: string;
  label: string;
  description: string;
  weight: number;
  categoryId: string;
  platforms: string[];
  /** docs/SPEC_REDACTEUR_EN_CHEF.md §4.5 — `undefined` laisse le mode inchangé (défaut base
   *  "rendez_vous" à la création) : l'édition manuelle de l'écran Direction ne le passe pas. */
  mode?: (typeof contentSeries.$inferInsert)["mode"];
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
        weight: item.weight,
        ...(item.mode !== undefined && { mode: item.mode }),
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
        weight: item.weight,
        ...(item.mode !== undefined && { mode: item.mode }),
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
 *  et resynchronise le rôle à chaque mise à jour. */
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

  return listActiveSeriesForUser(userId); // relit pour renvoyer la forme jointe à jour
}

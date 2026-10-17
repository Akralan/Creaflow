import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  creatorProfiles,
  products,
  contentCategories,
  contentAngles,
  contentSeries,
  scriptGenerationEvents,
  scripts,
} from "@/db/schema";
import type { GeneratedScript } from "@/lib/llm/scriptSchema";
import type { ContentCategoryContext, ContentType, Platform, ScriptGenerationContext } from "@/lib/llm/prompts";
import { parseStoredStyleProfile } from "@/lib/llm/styleProfile";
import { parseStoredReaderPortrait } from "@/lib/llm/readerPortrait";
import { loadRecentPostCards } from "@/lib/services/recentPostsService";
import { applyInspirationFeedback, loadInspirationsForGeneration } from "@/lib/services/inspirationService";
import { buildPerformanceSummary } from "@/lib/services/performanceService";
import { pickAngleForScript } from "@/lib/services/angleService";
import { findBestBrandAssetForScript } from "@/lib/services/brandAssetService";
import { getMaterialForSubject } from "@/lib/services/sourceMaterialService";
import { recordCitations, deleteCitationsForScript } from "@/lib/services/citationService";
import { resolveCategoryForGeneration } from "@/lib/services/seriesService";
import { buildEventBriefForSeries, ensureReaderForSeries } from "@/lib/services/seriesReaderService";
import { markDesignStale } from "@/lib/services/visualDesignService";
import type { VisualFormatSpec } from "@/lib/visualDesign/visualFormat";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

const RECENT_TOPICS_LIMIT = 15;
const SERIES_RECENT_TOPICS_LIMIT = 10;


/** Angle : recalculé normalement (mécanisme anti-répétition, pickAngleForScript) sauf si
 *  `lockedAngleId` est explicitement fourni (même `undefined` vs valeur — pas de sentinel exotique :
 *  passer `undefined` = comportement normal, passer une valeur, y compris `null`, = verrouillage).
 *  Utilisé par "autre idée, même brief" (docs/SPEC_PROMPT_GENERATION_TECH.md §6.1) : contrairement à
 *  l'ancien regenerate, l'angle du script existant est conservé tel quel, jamais recalculé — "verrouiller
 *  le brief, libérer les mots" (docs/SPEC_MATIERE_EDITEUR.md §1.3). */
async function resolveAngle(
  userId: string,
  contentCategoryId: string,
  excludeScriptId: string | null | undefined,
  lockedAngleId: string | null | undefined
) {
  if (lockedAngleId !== undefined) {
    if (lockedAngleId === null) return null;
    const found = await db.query.contentAngles.findFirst({
      where: and(eq(contentAngles.id, lockedAngleId), eq(contentAngles.userId, userId)),
      columns: { id: true, label: true, description: true },
    });
    // Dégradation gracieuse si l'angle a été archivé/supprimé entre-temps — pas une 404 bloquante,
    // même logique que listActiveAnglesForUser() qui ignore déjà les angles archivés ailleurs.
    return found ?? null;
  }
  const angle = await pickAngleForScript(userId, contentCategoryId, excludeScriptId);
  return angle ? { id: angle.id, label: angle.label, description: angle.description } : null;
}

/**
 * `contentCategoryId` : rôle du post libre ; ignoré (avec avertissement) si `seriesId` est fourni,
 * la série imposant son rôle unique (docs/SPEC_SERIES_ET_ROLES.md §4.2). `null` n'est valide
 * qu'avec une série — sinon 400.
 */
export async function buildGenerationContext(
  userId: string,
  platform: Platform,
  requestedCategoryId: string | null,
  contentType: ContentType,
  productId?: string | null,
  excludeScriptId?: string | null,
  seriesId?: string | null,
  lockedAngleId?: string | null,
  directive?: string | null,
  // "Autre idée, même brief" uniquement (docs/SPEC_PROMPT_GENERATION_TECH.md §6.1 point 2) — transmis
  // au choix du jour du chef pour qu'il propose une direction réellement différente (§3.3), pas
  // seulement au rédacteur via context.rejectedConcepts (assemblé plus bas, inchangé).
  rejectedConcepts?: string[],
  // Format du post visuel (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md) — choisi à la génération, relu
  // depuis le script pour les régénérations. Ignoré hors contentType "visual".
  visual?: VisualFormatSpec | null
): Promise<ScriptGenerationContext> {
  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, userId),
  });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur (Module A) avant de générer un script.");
  }

  const contentCategoryId = await resolveCategoryForGeneration(userId, { seriesId, contentCategoryId: requestedCategoryId });
  const category = await db.query.contentCategories.findFirst({
    where: and(eq(contentCategories.id, contentCategoryId), eq(contentCategories.userId, userId)),
  });
  if (!category) {
    throw new ApiError(404, "Rôle introuvable.");
  }

  let series = null;
  let seriesProductId: string | null = null;
  let seriesHasReader = false;
  if (seriesId) {
    const found = await db.query.contentSeries.findFirst({
      where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)),
    });
    if (!found) {
      throw new ApiError(404, "Série introuvable.");
    }
    series = { id: found.id, label: found.label, description: found.description };
    seriesProductId = found.productId;
    seriesHasReader = Boolean(found.readerLabel && found.form);
  }

  // « Autre idée, même brief » : le script réécrit garde son événement.
  const rewritten = excludeScriptId
    ? await db.query.scripts.findFirst({ where: eq(scripts.id, excludeScriptId), columns: { eventId: true } })
    : null;

  // Une série raconte sa ligne de temps à son lecteur (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5). Une
  // série d'avant le chantier reçoit d'office le public principal de son sujet. Sans rien à raconter,
  // on le dit plutôt que d'écrire un post sans événement.
  let eventBrief = null;
  if (seriesId) {
    if (!seriesHasReader) await ensureReaderForSeries(userId, seriesId);
    eventBrief = await buildEventBriefForSeries(userId, seriesId, rewritten?.eventId ?? null);
    if (!eventBrief) {
      throw new ApiError(
        409,
        "Rien à raconter pour cette série : sa ligne de temps est vide pour ce lecteur, ou tout a déjà été raconté. Ajoute de la matière, relis-la, ou choisis un autre lecteur dans la série."
      );
    }
  }

  // Sujet effectif : celui explicitement fourni prime, sinon le sujet lié à la série (sélecteur de
  // sujet, docs/SPEC_REDACTEUR_EN_CHEF.md) — pour que la matière lue (rédacteur ET chef) et les
  // citations enregistrées portent sur le bon corpus même quand ce script précis n'a pas lui-même
  // de sujet choisi. Exposé sur le contexte (`resolvedProductId`) pour que les appelants l'utilisent
  // à la création du script (Script.productId, citations) au lieu du `productId` brut de la requête.
  const effectiveProductId = productId ?? seriesProductId ?? null;

  let product = null;
  if (effectiveProductId) {
    product = await db.query.products.findFirst({
      where: and(eq(products.id, effectiveProductId), eq(products.userId, userId)),
    });
    if (!product) {
      throw new ApiError(404, "Produit introuvable.");
    }
  }

  const [recentScripts, performanceSummary, angle, materialDocuments, recentPosts, inspirationCards] = await Promise.all([
    db.query.scripts.findMany({
      where: and(
        eq(scripts.userId, userId),
        seriesId ? eq(scripts.seriesId, seriesId) : undefined,
        excludeScriptId ? ne(scripts.id, excludeScriptId) : undefined
      ),
      orderBy: desc(scripts.createdAt),
      limit: seriesId ? SERIES_RECENT_TOPICS_LIMIT : RECENT_TOPICS_LIMIT,
      columns: { title: true },
    }),
    buildPerformanceSummary(userId, platform),
    resolveAngle(userId, contentCategoryId, excludeScriptId, lockedAngleId),
    // Texte brut complet du sujet, annoté des passages déjà cités (docs/SPEC_MATIERE_EDITEUR.md §3)
    // — [] si le sujet n'a pas de corpus déposé. C'est le LLM qui décide quoi utiliser, aucune
    // présélection côté serveur.
    getMaterialForSubject(userId, effectiveProductId),
    // Mémoire des derniers posts du sujet (docs/SPEC_MEMOIRE_ET_VEILLE.md §2) — elle donne aussi les
    // publics visés récemment, pour alterner.
    loadRecentPostCards(userId, effectiveProductId, excludeScriptId ?? null),
    // Fiches de la veille d'inspiration du sujet (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3).
    loadInspirationsForGeneration(userId, effectiveProductId),
  ]);

  // Uniquement pour "visual" — un appel d'embedding serait un coût inutile sur les 2/3 des
  // générations (video/text) qui n'affichent aucune image de référence.
  const brandAsset =
    contentType === "visual"
      ? await findBestBrandAssetForScript(userId, {
          productId: effectiveProductId,
          categoryLabel: category.label,
          categoryDescription: category.description,
          seriesLabel: series?.label ?? null,
        })
      : null;


  return {
    creatorProfile: {
      brandName: profile.brandName,
      activityType: profile.activityType,
      expectations: profile.expectations,
      targetAudience: profile.targetAudience,
    },
    styleProfile: parseStoredStyleProfile(profile.styleProfile),
    product: product
      ? {
          name: product.name,
          description: product.description,
          valueProposition: product.valueProposition,
          targetAudience: product.targetAudience,
        }
      : null,
    readers: parseStoredReaderPortrait(product?.readerPortrait)?.readers ?? null,
    recentReaderLabels: recentPosts.map((p) => p.readerLabel).filter((l): l is string => l !== null),
    recentPosts,
    inspirations: inspirationCards,
    platform,
    contentCategory: { id: category.id, label: category.label, description: category.description },
    contentType,
    // title nullable depuis la naissance paresseuse (§4.5) — un brouillon sans titre n'est pas un
    // "sujet déjà traité" exploitable pour l'anti-répétition, on l'exclut simplement.
    recentTopics: recentScripts.map((s) => s.title).filter((title): title is string => title !== null),
    performanceSummary,
    angle,
    series,
    brandAsset,
    materialDocuments: materialDocuments.map((d) => ({ id: d.id, title: d.title, annotatedText: d.annotatedText })),
    directive: directive ?? null,
    eventBrief,
    resolvedProductId: effectiveProductId,
    visual: contentType === "visual" ? (visual ?? null) : null,
  };
}


/** Traduit le script généré (une des 3 formes selon contentType) en colonnes DB —
 *  les champs non pertinents pour ce type sont explicitement mis à null. */
function scriptColumnsFromGenerated(generated: GeneratedScript) {
  return {
    // Écrit à la création, figé ensuite (docs/SPEC_PROMPT_GENERATION_TECH.md §6.4) — cette fonction
    // n'est appelée que par createScriptRecord (génération complète) et par la route legacy
    // /api/scripts/:id/regenerate (updateScriptRecord, encore présente en code bien que désactivée
    // côté produit, cf. note en tête de la spec ; destinée à être remplacée par "autre idée" au Lot 3).
    // La régénération de bloc (regenerateBlock, microEditService.ts) ne passe JAMAIS par ici — elle
    // utilise patchScriptContent, donc ne touche jamais Script.concept, conformément au gel.
    concept: generated.concept,
    title: generated.title,
    caption: generated.caption,
    hashtags: generated.hashtags,
    contentType: generated.contentType,
    hookVisual: "hookVisual" in generated ? generated.hookVisual : null,
    hookText: "hookText" in generated ? generated.hookText : null,
    storyboard: "storyboard" in generated ? generated.storyboard : null,
    // Annexe B.6 (docs/SPEC_REDACTEUR_EN_CHEF.md Lot B3) — consolidées dans NarrativeState.openPromises
    // à la publication (§5, Lot B4).
    promisesMade: generated.promisesMade,
  };
}

export async function createScriptRecord(
  userId: string,
  platform: Platform,
  contentCategory: ContentCategoryContext,
  productId: string | null,
  generated: GeneratedScript,
  extras?: {
    angleId?: string | null;
    seriesId?: string | null;
    brandAssetId?: string | null;
    /** Format du post visuel (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md) — null hors "visual". */
    visual?: VisualFormatSpec | null;
    /** L'événement raconté (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5) — null hors rédacteur par événements. */
    eventId?: string | null;
  }
) {
  return db.transaction(async (tx) => {
    const columns = scriptColumnsFromGenerated(generated);
    const [script] = await tx
      .insert(scripts)
      .values({
        userId,
        productId,
        platform,
        contentCategoryId: contentCategory.id,
        angleId: extras?.angleId ?? null,
        seriesId: extras?.seriesId ?? null,
        brandAssetId: extras?.brandAssetId ?? null,
        eventId: extras?.eventId ?? null,
        visualFormat: extras?.visual?.format ?? "single",
        slideCount: extras?.visual?.slideCount ?? null,
        durationMs: extras?.visual?.durationMs ?? null,
        origin: "generated",
        // Gisement de la donnée de voix (§4.7) : capturé une seule fois, au premier jet — jamais
        // réécrit ensuite, y compris par une régénération (updateScriptRecord ne le touche pas).
        firstDraftSnapshot: columns,
        ...columns,
        // Hors de `columns` exprès : la trace n'a rien à faire dans le premier jet comparé par
        // l'apprentissage du style.
        generationTrace: generated.trace ?? null,
      })
      .returning();
    // Comptabilisé pour le quota de facturation (billingService.ts) — voir le commentaire sur
    // scriptGenerationEvents dans schema.ts.
    await tx.insert(scriptGenerationEvents).values({ userId, scriptId: script.id });
    // Citations post-génération (docs/SPEC_MATIERE_EDITEUR.md §3) — le LLM rapporte lui-même les
    // passages de matière utilisés, on les retrouve dans le texte source et on les enregistre.
    await recordCitations(tx, userId, script.id, productId, generated.usedExcerpts ?? []);
    return { ...script, contentCategory };
  }).then(async (script) => {
    await recordInspirationFeedback(userId, generated);
    return script;
  });
}

/** Retours du rédacteur sur les fiches d'inspiration (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3) — après
 *  l'enregistrement, hors transaction : un échec ici ne doit jamais faire perdre le script. */
async function recordInspirationFeedback(userId: string, generated: GeneratedScript): Promise<void> {
  await applyInspirationFeedback(userId, generated.trace).catch((err) =>
    logger.error("Retours sur les fiches d'inspiration non appliqués", err, { userId })
  );
}

export async function updateScriptRecord(
  userId: string,
  scriptId: string,
  contentCategory: ContentCategoryContext,
  generated: GeneratedScript,
  extras?: {
    angleId?: string | null;
    brandAssetId?: string | null;
    rejectedConcepts?: string[];
    /** Texte exact de la promesse ouverte que ce script honore — même rôle que sur createScriptRecord. */
    promiseHonored?: string | null;
    /** Sujet effectif pour le scoping des citations (`context.resolvedProductId`, scriptService.ts) —
     *  peut différer de `Script.productId` (jamais réécrit ici, brief verrouillé) quand ce script
     *  n'a lui-même aucun sujet mais que sa série en a un lié. Défaut : `script.productId` (comportement
     *  d'avant le sélecteur de sujet, pour le regenerate legacy qui ne le fournit pas). */
    citationsProductId?: string | null;
  }
) {
  return db.transaction(async (tx) => {
    const [script] = await tx
      .update(scripts)
      .set({
        ...(extras?.angleId !== undefined && { angleId: extras.angleId }),
        ...(extras?.brandAssetId !== undefined && { brandAssetId: extras.brandAssetId }),
        // "Autre idée, même brief" uniquement (docs/SPEC_PROMPT_GENERATION_TECH.md §6.1 point 2) — le
        // regenerate legacy n'en passe pas, rejectedConcepts reste alors inchangé.
        ...(extras?.rejectedConcepts !== undefined && { rejectedConcepts: extras.rejectedConcepts }),
        // Mutable comme concept/rejectedConcepts (pas figé comme firstDraftSnapshot) — "autre idée"
        // peut aussi passer par un nouveau choix du jour du chef (docs/SPEC_REDACTEUR_EN_CHEF.md §4.1).
        ...(extras?.promiseHonored !== undefined && { promiseHonored: extras.promiseHonored }),
        ...scriptColumnsFromGenerated(generated),
        generationTrace: generated.trace ?? null,
        updatedAt: new Date(),
      })
      .where(eq(scripts.id, scriptId))
      .returning();
    // Une régénération ne change pas `scripts.createdAt` (même ligne, mise à jour en place) — sans
    // cet événement, enforceScriptQuota() ne verrait jamais les régénérations, qui coûtent pourtant
    // un appel LLM comme une génération initiale.
    await tx.insert(scriptGenerationEvents).values({ userId, scriptId: script.id });
    // Réécrit à chaque régénération — le brief peut avoir changé, les citations précédentes sont obsolètes.
    await deleteCitationsForScript(tx, script.id);
    await recordCitations(tx, userId, script.id, extras?.citationsProductId ?? script.productId, generated.usedExcerpts ?? []);
    return { ...script, contentCategory };
  }).then(async (script) => {
    await recordInspirationFeedback(userId, generated);
    return script;
  });
}

export interface ScriptContentPatch {
  status?: (typeof scripts.$inferSelect)["status"];
  title?: string;
  hookVisual?: string;
  hookText?: string;
  storyboard?: { planNumber: number; description: string }[];
  caption?: string;
  hashtags?: string[];
}

/**
 * PATCH de contenu depuis l'éditeur (docs/SPEC_MATIERE_EDITEUR.md §4.5) — édition directe d'un
 * bloc (`onBlur`) ou naissance paresseuse du premier contenu tapé. Ne touche jamais à
 * `contentCategoryId`/`angleId`/`seriesId` (brief verrouillé, §4.2) ni à `firstDraftSnapshot`.
 * Passage en "published" (§5, Lot B4) : déclenche les effets de bord du chef (beat -> published,
 * promesses) — jamais bloquant, une panne ici ne doit jamais faire échouer le changement de statut.
 */
export async function patchScriptContent(userId: string, scriptId: string, patch: ScriptContentPatch) {
  const [script] = await db
    .update(scripts)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(scripts.id, scriptId), eq(scripts.userId, userId)))
    .returning();
  if (!script) {
    throw new ApiError(404, "Script introuvable.");
  }
  // Les mots de la maquette viennent du storyboard (docs/SPEC_DESIGN_HTML_SUR_IMAGE.md §2) : quand
  // ils changent, la maquette passe en "stale" — badge côté éditeur, jamais bloquant.
  if (script.contentType === "visual" && (patch.title !== undefined || patch.hookVisual !== undefined || patch.storyboard !== undefined)) {
    await markDesignStale(script.id);
  }
  return script;
}

/**
 * Suppression d'un brouillon (docs/SPEC_MATIERE_EDITEUR.md §4.5) — pendant de la naissance
 * paresseuse. Cascade DB déjà en place pour postMetrics/postMatchCandidates/visualDesigns ; SET NULL
 * pour calendarEntries.scriptId (le créneau survit et redevient générable) et pour les événements
 * de génération et de retouche, qui restent comptés dans le quota (docs/SPEC_QUOTAS_ADMIN.md).
 */
export async function deleteScriptForUser(userId: string, scriptId: string) {
  const [deleted] = await db
    .delete(scripts)
    .where(and(eq(scripts.id, scriptId), eq(scripts.userId, userId)))
    .returning({ id: scripts.id });
  if (!deleted) {
    throw new ApiError(404, "Script introuvable.");
  }
  return deleted;
}

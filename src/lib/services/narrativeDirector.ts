import { z } from "zod";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { narrativeState, products, contentSeries, creatorProfiles, scripts, sourceMaterials, sourceMaterialCitations } from "@/db/schema";
import {
  planNarrative,
  chooseDailyDirection,
  type LlmNarrativeBeat,
  type NarrativePlanContext,
  type NarrativePlanDocumentContext,
  type DailyDirectionBeatCandidate,
} from "@/lib/llm/narrativePrompts";
import { backfillMaterialSummaries } from "@/lib/services/sourceMaterialService";
import { ApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

const MAX_FOCUS_DOCS = 3;
const MAX_CALLBACKS = 8;
const MAX_BEATS = 20;
const MAX_OPEN_PROMISES = 10;
const PUBLISHED_CONCEPTS_LIMIT = 30;

export type NarrativeBeatKind = "material" | "pedagogical" | "personal";
export type NarrativeBeatStatus = "planned" | "drafted" | "published" | "skipped";

export interface NarrativeBeat {
  id: string;
  title: string;
  kind: NarrativeBeatKind;
  angleHint: string | null;
  focusDocIds: string[];
  status: NarrativeBeatStatus;
  scriptId: string | null;
  rationale: string;
}

export interface NarrativePromise {
  text: string;
  scriptId: string;
  madeAt: string;
}

/** Validateur de la forme d'un beat soumis par le client (PATCH) — même forme que la ligne stockée. */
export const narrativeBeatSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(["material", "pedagogical", "personal"]),
  angleHint: z.string().nullable(),
  focusDocIds: z.array(z.string()),
  status: z.enum(["planned", "drafted", "published", "skipped"]),
  scriptId: z.string().nullable(),
  rationale: z.string().min(1),
});

type NarrativeStateSelect = typeof narrativeState.$inferSelect;

export interface NarrativeStateDTO extends Omit<NarrativeStateSelect, "beats" | "openPromises" | "callbacks"> {
  beats: NarrativeBeat[];
  openPromises: NarrativePromise[];
  callbacks: string[];
}

function toNarrativeStateDTO(row: NarrativeStateSelect): NarrativeStateDTO {
  return {
    ...row,
    beats: (row.beats as NarrativeBeat[] | null) ?? [],
    openPromises: (row.openPromises as NarrativePromise[] | null) ?? [],
    callbacks: (row.callbacks as string[] | null) ?? [],
  };
}

function narrativeStateWhere(userId: string, productId: string | null, seriesId: string | null) {
  return and(
    eq(narrativeState.userId, userId),
    productId ? eq(narrativeState.productId, productId) : isNull(narrativeState.productId),
    seriesId ? eq(narrativeState.seriesId, seriesId) : isNull(narrativeState.seriesId)
  );
}

/** État narratif d'un sujet exact (productId/seriesId tels quels), ou `null` si jamais planifié. Pas
 *  de création implicite ici — c'est {@link planNarrativeForSubject} qui crée paresseusement. */
export async function findNarrativeState(
  userId: string,
  productId: string | null,
  seriesId: string | null
): Promise<NarrativeStateDTO | null> {
  const row = await db.query.narrativeState.findFirst({ where: narrativeStateWhere(userId, productId, seriesId) });
  return row ? toNarrativeStateDTO(row) : null;
}

/** États narratifs de plusieurs séries d'un coup (agrégation de l'écran Direction, §6) — un
 *  seul aller-retour DB, jamais deux états pour une même série (productId toujours null ici : les
 *  séries "Direction" ne portent pas de produit associé, contrairement au mécanisme one-shot
 *  "série depuis la matière" qui, lui, scope la matière par produit indépendamment). */
export async function findNarrativeStatesForSeries(
  userId: string,
  seriesIds: string[]
): Promise<Map<string, NarrativeStateDTO>> {
  if (seriesIds.length === 0) return new Map();
  const rows = await db.query.narrativeState.findMany({
    where: and(eq(narrativeState.userId, userId), inArray(narrativeState.seriesId, seriesIds), isNull(narrativeState.productId)),
  });
  return new Map(rows.filter((r) => r.seriesId !== null).map((r) => [r.seriesId as string, toNarrativeStateDTO(r)]));
}

/**
 * Résout le sujet effectif d'une génération/planification. Une série avec un sujet lié
 * (`ContentSeries.productId`, sélecteur de sujet) prime sur le `productId` fourni quand il est
 * absent — sinon le rédacteur en chef n'a aucune matière à lire pour une série qui n'a pas
 * elle-même de `productId` explicite ailleurs (Script.productId, requête de planification...).
 * `effectiveProductId` est celui à utiliser pour toute lecture de matière/citations ; `productId`
 * (le paramètre d'entrée, potentiellement `null`) reste la bonne clé pour l'identité de
 * NarrativeState, qui ne dépend jamais du sujet lié à la série (voir narrativeStateWhere).
 */
async function resolveSubject(userId: string, productId: string | null, seriesId: string | null) {
  let series = null;
  if (seriesId) {
    series = await db.query.contentSeries.findFirst({ where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)) });
    if (!series) throw new ApiError(404, "Série introuvable.");
  }
  const effectiveProductId = productId ?? series?.productId ?? null;
  let product = null;
  if (effectiveProductId) {
    product = await db.query.products.findFirst({ where: and(eq(products.id, effectiveProductId), eq(products.userId, userId)) });
    if (!product) throw new ApiError(404, "Sujet introuvable.");
  }
  const subjectLabel = series?.label ?? product?.name ?? "l'activité de la marque";
  return { product, series, subjectLabel, effectiveProductId };
}

async function loadDocumentSummaries(userId: string, productId: string | null): Promise<NarrativePlanDocumentContext[]> {
  const materials = await db.query.sourceMaterials.findMany({
    where: and(
      eq(sourceMaterials.userId, userId),
      productId ? eq(sourceMaterials.productId, productId) : isNull(sourceMaterials.productId)
    ),
    orderBy: desc(sourceMaterials.createdAt),
    columns: { id: true, summary: true },
  });
  if (materials.length === 0) return [];

  const citations = await db.query.sourceMaterialCitations.findMany({
    where: and(
      eq(sourceMaterialCitations.userId, userId),
      inArray(
        sourceMaterialCitations.sourceMaterialId,
        materials.map((m) => m.id)
      )
    ),
    columns: { sourceMaterialId: true },
  });
  const usedIds = new Set(citations.map((c) => c.sourceMaterialId).filter((id): id is string => id !== null));

  return materials.map((m) => ({ id: m.id, summary: m.summary, alreadyUsed: usedIds.has(m.id) }));
}

/** Concepts publiés du sujet exact (même scoping que l'état narratif) — anti-répétition (§3.2). */
async function loadPublishedConcepts(userId: string, productId: string | null, seriesId: string | null): Promise<string[]> {
  const subjectMatch = productId
    ? eq(scripts.productId, productId)
    : seriesId
      ? eq(scripts.seriesId, seriesId)
      : and(isNull(scripts.productId), isNull(scripts.seriesId));
  const rows = await db.query.scripts.findMany({
    where: and(eq(scripts.userId, userId), eq(scripts.status, "published"), subjectMatch),
    columns: { concept: true },
    orderBy: desc(scripts.createdAt),
    // Filet anti-croissance illimitée du prompt — même esprit que RECENT_TOPICS_LIMIT (scriptService.ts),
    // pas une contrainte de la spec.
    limit: PUBLISHED_CONCEPTS_LIMIT,
  });
  return rows.map((r) => r.concept).filter((c): c is string => c !== null);
}

/**
 * Merge serveur du plan renvoyé par le LLM avec l'état existant (§3.2) : les beats `published` sont
 * intouchables (contenu ET présence — jamais rétrogradés, jamais retirés même si le LLM les omet),
 * `scriptId` n'est jamais affirmé par le chef (préservé depuis l'existant), et un beat que le LLM
 * marquerait `published` de son propre chef est ramené à son statut précédent (filet de sécurité en
 * plus de la consigne B.2a).
 *
 * Extension Lot B4 (au-delà du texte de la spec) : un beat `drafted` — un script existe déjà dessus,
 * pas encore publié — bénéficie de la même garantie de PRÉSENCE qu'un beat `published` (jamais perdu
 * s'il est omis de la réponse du LLM, sans quoi le bandeau éditeur du script déjà généré perdrait
 * son lien vers l'arc), mais pas de la même garantie de CONTENU : le chef peut encore affiner son
 * titre/angle/justification/kind s'il le retourne explicitement — seuls `status` (reste `drafted`,
 * jamais rétrogradé) et `scriptId` (jamais réaffirmé par le chef) restent figés.
 */
function mergeBeats(existingBeats: NarrativeBeat[], llmBeats: LlmNarrativeBeat[]): NarrativeBeat[] {
  const existingById = new Map(existingBeats.map((b) => [b.id, b]));
  const seenIds = new Set<string>();
  const merged: NarrativeBeat[] = [];

  for (const llmBeat of llmBeats) {
    const existing = existingById.get(llmBeat.id);
    if (existing?.status === "published") {
      merged.push(existing);
    } else if (existing?.status === "drafted") {
      merged.push({
        id: llmBeat.id,
        title: llmBeat.title,
        kind: llmBeat.kind,
        angleHint: llmBeat.angleHint,
        focusDocIds: llmBeat.focusDocIds.slice(0, MAX_FOCUS_DOCS),
        status: "drafted",
        scriptId: existing.scriptId,
        rationale: llmBeat.rationale,
      });
    } else {
      merged.push({
        id: llmBeat.id,
        title: llmBeat.title,
        kind: llmBeat.kind,
        angleHint: llmBeat.angleHint,
        focusDocIds: llmBeat.focusDocIds.slice(0, MAX_FOCUS_DOCS),
        status: llmBeat.status === "published" ? (existing?.status ?? "planned") : llmBeat.status,
        scriptId: existing?.scriptId ?? null,
        rationale: llmBeat.rationale,
      });
    }
    seenIds.add(llmBeat.id);
  }

  // Beats publiés OU en brouillon omis par le LLM : jamais perdus (un script existe déjà pour eux),
  // rajoutés à la fin dans leur ordre relatif d'origine — décision d'implémentation, la spec ne
  // précise pas la position exacte pour ce cas.
  for (const existing of existingBeats) {
    if ((existing.status === "published" || existing.status === "drafted") && !seenIds.has(existing.id)) {
      merged.push(existing);
    }
  }

  return merged;
}

/** Plafond §5 : au-delà de 20 beats, retire les `published` les plus anciens (les premiers dans
 *  l'ordre du tableau) — jamais les `drafted`/`planned`, jamais rien qui reste à faire. L'historique
 *  reste traçable via `Script.beatId` même une fois le beat retiré de ce tableau de travail. */
function capBeats(beats: NarrativeBeat[]): NarrativeBeat[] {
  if (beats.length <= MAX_BEATS) return beats;
  const result = [...beats];
  while (result.length > MAX_BEATS) {
    const idx = result.findIndex((b) => b.status === "published");
    if (idx === -1) break; // rien de publié à retirer — dépasse le plafond, cas rare (le LLM en a trop proposé)
    result.splice(idx, 1);
  }
  return result;
}

/**
 * Planification glissante (docs/SPEC_REDACTEUR_EN_CHEF.md §3.2) — crée l'état paresseusement à la
 * première planification. Backfill des résumés manquants avant tout (séquentiel), 409 si la cible
 * est une série en mode rendez_vous (pas de plan à maintenir dans ce mode).
 */
export async function planNarrativeForSubject(
  userId: string,
  params: { productId?: string | null; seriesId?: string | null; directive?: string | null }
): Promise<NarrativeStateDTO> {
  const productId = params.productId ?? null;
  const seriesId = params.seriesId ?? null;

  const { product, series, subjectLabel, effectiveProductId } = await resolveSubject(userId, productId, seriesId);

  if (series && series.mode === "rendez_vous") {
    throw new ApiError(409, "Cette série est en mode rendez-vous : chaque épisode est autonome, pas de plan à maintenir.");
  }

  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur (Module A) avant de planifier.");
  }

  // Backfill paresseux (§3.1) : matière scopée par le sujet effectif (sélecteur de sujet de la
  // série s'il y en a un, sinon le productId fourni) — une série sans sujet du tout retombe sur la
  // matière de niveau marque.
  await backfillMaterialSummaries(userId, effectiveProductId);

  // Identité de l'état narratif : toujours le `productId` d'entrée (souvent null pour une série),
  // jamais `effectiveProductId` — le sujet lié à la série ne fait pas naître un état distinct par
  // sujet, il change seulement quelle matière ce plan de série lit.
  const existing = await findNarrativeState(userId, productId, seriesId);
  const existingBeats = existing?.beats ?? [];
  const existingCallbacks = existing?.callbacks ?? [];

  const [documents, publishedConcepts] = await Promise.all([
    loadDocumentSummaries(userId, effectiveProductId),
    loadPublishedConcepts(userId, productId, seriesId),
  ]);

  const planContext: NarrativePlanContext = {
    brandName: profile.brandName,
    activityType: profile.activityType,
    targetAudience: product?.targetAudience ?? profile.targetAudience,
    subjectLabel,
    arcSummary: existing?.arcSummary ?? null,
    beats: existingBeats.map((b) => ({ id: b.id, title: b.title, kind: b.kind, status: b.status, rationale: b.rationale })),
    callbacks: existingCallbacks,
    formatContract: existing?.formatContract ?? null,
    documents,
    publishedConcepts,
    directive: params.directive ?? null,
  };

  const result = await planNarrative(planContext);
  const mergedBeats = capBeats(mergeBeats(existingBeats, result.beats));
  const cappedCallbacks = result.callbacks.slice(0, MAX_CALLBACKS);
  const now = new Date();

  const [row] = existing
    ? await db
        .update(narrativeState)
        .set({
          arcSummary: result.arcSummary,
          beats: mergedBeats,
          callbacks: cappedCallbacks,
          isStale: false,
          lastPlannedAt: now,
          updatedAt: now,
        })
        .where(eq(narrativeState.id, existing.id))
        .returning()
    : await db
        .insert(narrativeState)
        .values({
          userId,
          productId,
          seriesId,
          arcSummary: result.arcSummary,
          beats: mergedBeats,
          callbacks: cappedCallbacks,
          isStale: false,
          lastPlannedAt: now,
        })
        .returning();

  return toNarrativeStateDTO(row);
}

export interface NarrativeStatePatch {
  arcSummary?: string;
  formatContract?: string | null;
  beats?: NarrativeBeat[];
  callbacks?: string[];
  closePromiseText?: string;
}

/**
 * Valide qu'une édition manuelle de `beats` (§7) reste dans les clous : mêmes ids que l'existant
 * (pas de création/suppression via cette porte — seule la planification en ajoute), un beat publié
 * intégralement figé (le réordonner reste permis), et pour les autres beats seuls titre/angleHint/
 * kind/statut sont éditables — statut ne pouvant transiter que vers "skipped" ("passer en passé",
 * §7 ; jamais "drafted"/"published", gérés par le système). Décision d'implémentation : la spec
 * liste "title/angleHint/kind" et "passer skipped" comme éditables, rien de plus.
 */
function applyBeatsPatch(existingBeats: NarrativeBeat[], submitted: NarrativeBeat[]): NarrativeBeat[] {
  const existingById = new Map(existingBeats.map((b) => [b.id, b]));
  if (submitted.length !== existingBeats.length || submitted.some((b) => !existingById.has(b.id))) {
    throw new ApiError(400, "Les beats soumis doivent correspondre exactement aux beats existants.");
  }
  for (const beat of submitted) {
    const existing = existingById.get(beat.id)!;
    const sameFocusDocs = JSON.stringify(beat.focusDocIds) === JSON.stringify(existing.focusDocIds);
    if (existing.status === "published") {
      const unchanged =
        beat.title === existing.title &&
        beat.kind === existing.kind &&
        beat.angleHint === existing.angleHint &&
        beat.status === existing.status &&
        sameFocusDocs &&
        beat.rationale === existing.rationale &&
        beat.scriptId === existing.scriptId;
      if (!unchanged) {
        throw new ApiError(400, `Le beat publié "${existing.title}" ne peut pas être modifié.`);
      }
      continue;
    }
    if (!sameFocusDocs || beat.rationale !== existing.rationale || beat.scriptId !== existing.scriptId) {
      throw new ApiError(400, `Seuls le titre, l'angle et le statut sont éditables sur le beat "${existing.title}".`);
    }
    if (beat.status !== existing.status && beat.status !== "skipped") {
      throw new ApiError(400, `Statut non autorisé pour une édition manuelle : "${beat.status}".`);
    }
  }
  return submitted;
}

/** Éditions utilisateur de l'écran Direction (§6/§7) — arcSummary, formatContract, beats (réordonner/
 *  éditer/passer skipped), fermeture manuelle d'une promesse, édition des callbacks. */
export async function patchNarrativeStateForUser(
  userId: string,
  stateId: string,
  patch: NarrativeStatePatch
): Promise<NarrativeStateDTO> {
  const existing = await db.query.narrativeState.findFirst({
    where: and(eq(narrativeState.id, stateId), eq(narrativeState.userId, userId)),
  });
  if (!existing) {
    throw new ApiError(404, "État narratif introuvable.");
  }
  const existingBeats = (existing.beats as NarrativeBeat[] | null) ?? [];
  const existingOpenPromises = (existing.openPromises as NarrativePromise[] | null) ?? [];

  const set: Partial<NarrativeStateSelect> = { updatedAt: new Date() };
  if (patch.arcSummary !== undefined) set.arcSummary = patch.arcSummary;
  if (patch.formatContract !== undefined) set.formatContract = patch.formatContract;
  if (patch.callbacks !== undefined) set.callbacks = patch.callbacks.slice(0, MAX_CALLBACKS);
  if (patch.beats !== undefined) set.beats = applyBeatsPatch(existingBeats, patch.beats);
  if (patch.closePromiseText !== undefined) {
    set.openPromises = existingOpenPromises.filter((p) => p.text !== patch.closePromiseText);
  }

  const [row] = await db.update(narrativeState).set(set).where(eq(narrativeState.id, stateId)).returning();
  return toNarrativeStateDTO(row);
}

// ---------------------------------------------------------------------------------------------
// Choix du jour (docs/SPEC_REDACTEUR_EN_CHEF.md §3.3/§4.1) — interne au flux de génération.
// ---------------------------------------------------------------------------------------------

/**
 * Résolution de l'état à la génération (§2/§4.1.2) : série > produit > marque, jamais de création
 * implicite — pas d'état = pas de chef. Contrairement à {@link planNarrativeForSubject}, ne crée
 * jamais rien : seule une planification explicite fait naître un état.
 */
export async function resolveNarrativeState(
  userId: string,
  productId: string | null,
  seriesId: string | null
): Promise<NarrativeStateDTO | null> {
  if (seriesId) {
    const state = await findNarrativeState(userId, null, seriesId);
    if (state) return state;
  }
  if (productId) {
    const state = await findNarrativeState(userId, productId, null);
    if (state) return state;
  }
  return findNarrativeState(userId, null, null);
}

/**
 * Où chaque document de matière est consommé dans les plans (espace matière, maquette 1c) : lecture
 * seule, sans jamais créer d'état — un simple affichage ne doit pas provoquer d'effet de bord. Couvre
 * l'état du sujet lui-même et ceux des séries qui lui sont rattachées, puisqu'un beat porte ses
 * `focusDocIds` quel que soit le niveau où vit le plan.
 *
 * Renvoie, par id de document, le premier beat qui l'utilise : son rang (1-based, épisodes passés
 * inclus) et son titre.
 */
export async function findDocumentUsage(
  userId: string,
  productId: string
): Promise<Map<string, { episode: number; beatTitle: string }>> {
  const seriesOfProduct = await db.query.contentSeries.findMany({
    where: and(eq(contentSeries.userId, userId), eq(contentSeries.productId, productId)),
    columns: { id: true },
  });
  const seriesIds = seriesOfProduct.map((s) => s.id);

  const rows = await db.query.narrativeState.findMany({
    where: and(
      eq(narrativeState.userId, userId),
      seriesIds.length > 0
        ? or(eq(narrativeState.productId, productId), inArray(narrativeState.seriesId, seriesIds))
        : eq(narrativeState.productId, productId)
    ),
  });

  const usage = new Map<string, { episode: number; beatTitle: string }>();
  for (const row of rows) {
    const beats = ((row.beats as NarrativeBeat[] | null) ?? []).filter((b) => b.status !== "skipped");
    beats.forEach((beat, index) => {
      for (const docId of beat.focusDocIds) {
        if (!usage.has(docId)) usage.set(docId, { episode: index + 1, beatTitle: beat.title });
      }
    });
  }
  return usage;
}

export interface DailyDirection {
  /** Traçabilité pour {@link markBeatDrafted} après génération — ne sert pas à l'assemblage du message. */
  stateId: string;
  beatId: string | null;
  beatTitle: string | null;
  concept: string;
  kind: NarrativeBeatKind;
  focusDocIds: string[];
  callbackToUse: string | null;
  promiseToHonor: string | null;
  promiseToMake: string | null;
  angleHint: string | null;
}

/**
 * Choix du jour (§3.3), orchestré ici — jamais un endpoint, appelé depuis `buildGenerationContext`
 * (scriptService.ts). Ne lève JAMAIS : toute erreur (état absent, profil absent, appel LLM, parsing)
 * renvoie `null` — dégradation silencieuse vers le pipeline actuel (§4.1 point 4), le chef n'est
 * jamais bloquant.
 */
export async function resolveDailyDirection(
  userId: string,
  params: {
    productId: string | null;
    seriesId: string | null;
    platform: string;
    contentCategoryLabel: string;
    contentCategoryDescription: string;
    contentType: string;
    directive?: string | null;
    rejectedConcepts?: string[];
  }
): Promise<DailyDirection | null> {
  try {
    let state = await resolveNarrativeState(userId, params.productId, params.seriesId);
    if (!state) return null; // pas d'état = pas de chef (§2)

    // Un sujet hors série = arc léger, régime feuilleton (§1).
    const { product, series, subjectLabel, effectiveProductId } = await resolveSubject(userId, state.productId, state.seriesId);
    const mode = series?.mode ?? "feuilleton";

    // Replanification paresseuse avant le choix du jour, mode feuilleton uniquement (§3.2/§4.1.3) —
    // le mode rendez_vous n'a pas de beats à maintenir.
    if (mode === "feuilleton" && state.isStale) {
      state = await planNarrativeForSubject(userId, {
        productId: state.productId,
        seriesId: state.seriesId,
        // La replanification paresseuse n'est pas un geste utilisateur : elle n'injecte pas la
        // directive du jour, réservée à l'appel choix du jour qui suit.
        directive: null,
      });
    }

    const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
    if (!profile) return null; // pas de profil = pas de chef, dégradation silencieuse

    const openPromiseTexts = state.openPromises.map((p) => p.text);
    const baseContext = {
      brandName: profile.brandName,
      activityType: profile.activityType,
      targetAudience: product?.targetAudience ?? profile.targetAudience,
      subjectLabel,
      mode,
      platform: params.platform,
      contentCategoryLabel: params.contentCategoryLabel,
      contentCategoryDescription: params.contentCategoryDescription,
      contentType: params.contentType,
      directive: params.directive ?? null,
      rejectedConcepts: params.rejectedConcepts,
      openPromiseTexts,
      callbacks: state.callbacks,
    };

    const dailyContext =
      mode === "feuilleton"
        ? {
            ...baseContext,
            arcSummary: state.arcSummary,
            beats: state.beats
              .filter((b): b is NarrativeBeat & { status: "planned" | "drafted" } => b.status === "planned" || b.status === "drafted")
              .map(
                (b): DailyDirectionBeatCandidate => ({ id: b.id, title: b.title, kind: b.kind, status: b.status, rationale: b.rationale })
              ),
            // Documents candidats : ceux référencés par les beats à venir (planned/drafted), pas tout
            // le corpus déjà résumé côté planification — décision d'implémentation, la spec ne
            // précise pas exactement quels "focusDocs candidats" en mode feuilleton.
            documents: (await loadDocumentSummaries(userId, effectiveProductId)).filter((d) =>
              state.beats.some((b) => (b.status === "planned" || b.status === "drafted") && b.focusDocIds.includes(d.id))
            ),
          }
        : {
            ...baseContext,
            formatContract: state.formatContract,
            publishedConcepts: await loadPublishedConcepts(userId, state.productId, state.seriesId),
            // Biais de fraîcheur explicite (§3.3) : les 20 docs les plus récents, déjà triés
            // desc(createdAt) par loadDocumentSummaries.
            documents: (await loadDocumentSummaries(userId, effectiveProductId)).slice(0, 20),
          };

    const result = await chooseDailyDirection(dailyContext);

    const beat = result.beatId ? state.beats.find((b) => b.id === result.beatId) : undefined;
    return {
      stateId: state.id,
      beatId: beat ? beat.id : null, // ignore un beatId halluciné ne correspondant à aucun beat connu
      beatTitle: beat?.title ?? null,
      concept: result.concept,
      kind: result.kind,
      focusDocIds: result.focusDocIds.slice(0, MAX_FOCUS_DOCS),
      callbackToUse: result.callbackToUse,
      promiseToHonor: result.promiseToHonor,
      promiseToMake: result.promiseToMake,
      angleHint: result.angleHint,
    };
  } catch (err) {
    logger.error("Choix du jour échoué — dégradation silencieuse vers le pipeline sans chef", err, {
      userId,
      productId: params.productId,
      seriesId: params.seriesId,
    });
    return null;
  }
}

/** Bandeau éditeur (docs/SPEC_REDACTEUR_EN_CHEF.md §7 : "Épisode de l'arc : ${beat.title}") — résout
 *  le titre d'un beat depuis le contexte (productId/seriesId) d'un script qui porte ce beatId.
 *  `null` si l'état ou le beat n'existe plus (script orphelin d'un plan remanié — pas une erreur). */
export async function findBeatTitle(
  userId: string,
  productId: string | null,
  seriesId: string | null,
  beatId: string
): Promise<string | null> {
  const state = await resolveNarrativeState(userId, productId, seriesId);
  return state?.beats.find((b) => b.id === beatId)?.title ?? null;
}

/**
 * Contexte éditorial affiché en tête de l'éditeur (maquette 1b) : au-delà du titre du beat, la
 * direction éditoriale qui a présidé à son choix et les callbacks de la série à replacer. Résolu à
 * la lecture, jamais stocké — un beat peut être réécrit ou déplacé entre deux ouvertures du script.
 *
 * Les callbacks sont ceux de la série entière, pas un ciblage par script : le rédacteur en chef ne
 * les assigne pas épisode par épisode. L'éditeur les présente donc comme des détails familiers
 * disponibles, pas comme une consigne.
 */
export async function findBeatContext(
  userId: string,
  productId: string | null,
  seriesId: string | null,
  beatId: string
): Promise<{ title: string | null; rationale: string | null; angleHint: string | null; callbacks: string[] }> {
  const state = await resolveNarrativeState(userId, productId, seriesId);
  const beat = state?.beats.find((b) => b.id === beatId) ?? null;
  return {
    title: beat?.title ?? null,
    rationale: beat?.rationale ?? null,
    angleHint: beat?.angleHint ?? null,
    callbacks: state?.callbacks ?? [],
  };
}

/**
 * Après génération réussie (§4.1.6) : le beat choisi passe en "drafted" et pointe le script créé.
 * Jamais bloquant — l'appelant catch et journalise, un échec ici ne doit jamais faire échouer une
 * génération qui a réussi.
 */
export async function markBeatDrafted(stateId: string, beatId: string, scriptId: string): Promise<void> {
  const state = await db.query.narrativeState.findFirst({ where: eq(narrativeState.id, stateId) });
  if (!state) return;
  const beats = (state.beats as NarrativeBeat[] | null) ?? [];
  const idx = beats.findIndex((b) => b.id === beatId);
  if (idx === -1) return;
  const updatedBeats = beats.map((b, i) => (i === idx ? { ...b, status: "drafted" as const, scriptId } : b));
  await db.update(narrativeState).set({ beats: updatedBeats, updatedAt: new Date() }).where(eq(narrativeState.id, stateId));
}

// ---------------------------------------------------------------------------------------------
// Cycle de vie (docs/SPEC_REDACTEUR_EN_CHEF.md §5, Lot B4) — règles serveur, sans LLM.
// ---------------------------------------------------------------------------------------------

/**
 * Effets de bord du passage d'un script en "published" (§5) : le beat associé (le cas échéant)
 * passe en "published" dans le plan, les nouvelles promesses de ce script (`Script.promisesMade`)
 * rejoignent `openPromises` (dédupliquées par texte exact, plafonnées à 10 — les plus anciennes
 * sortent), et la promesse que ce script honorait (`Script.promiseHonored`, choisie par le chef au
 * choix du jour, §3.3) en sort. Idempotent — rejouable sans effet si le script repasse par
 * "published" (aucune écriture si rien ne change). Jamais bloquant : l'appelant catch et journalise
 * (scriptService.ts::patchScriptContent), un échec ici ne doit jamais faire échouer un changement de
 * statut qui a réussi.
 */
export async function applyPublishSideEffects(
  userId: string,
  script: {
    id: string;
    productId: string | null;
    seriesId: string | null;
    beatId: string | null;
    promisesMade: unknown;
    promiseHonored: string | null;
  }
): Promise<void> {
  const state = await resolveNarrativeState(userId, script.productId, script.seriesId);
  if (!state) return;

  let beats = state.beats;
  let beatsChanged = false;
  if (script.beatId) {
    const idx = beats.findIndex((b) => b.id === script.beatId);
    if (idx !== -1 && beats[idx].status !== "published") {
      beats = beats.map((b, i) => (i === idx ? { ...b, status: "published" as const } : b));
      beatsChanged = true;
    }
  }

  let openPromises = state.openPromises;
  let promisesChanged = false;

  const promisesMade = Array.isArray(script.promisesMade) ? (script.promisesMade as string[]) : [];
  if (promisesMade.length > 0) {
    const existingTexts = new Set(openPromises.map((p) => p.text));
    const fresh = promisesMade.filter((text) => !existingTexts.has(text));
    if (fresh.length > 0) {
      const now = new Date().toISOString();
      openPromises = [...openPromises, ...fresh.map((text) => ({ text, scriptId: script.id, madeAt: now }))].slice(-MAX_OPEN_PROMISES);
      promisesChanged = true;
    }
  }

  if (script.promiseHonored) {
    const filtered = openPromises.filter((p) => p.text !== script.promiseHonored);
    if (filtered.length !== openPromises.length) {
      openPromises = filtered;
      promisesChanged = true;
    }
  }

  if (!beatsChanged && !promisesChanged) return;

  await db
    .update(narrativeState)
    .set({
      // La publication ne fait jamais grandir le tableau de beats (elle ne fait que changer le
      // statut d'une entrée déjà présente) — pas besoin de capBeats ici, contrairement à la
      // planification.
      ...(beatsChanged && { beats }),
      ...(promisesChanged && { openPromises }),
      updatedAt: new Date(),
    })
    .where(eq(narrativeState.id, state.id));
}

/**
 * Existe ou crée une ligne NarrativeState vide, sans jamais appeler le LLM ni vérifier le mode de
 * la série — contrairement à {@link planNarrativeForSubject}, qui refuse (409) les séries
 * rendez_vous. Nécessaire pour que le mode rendez_vous ait un endroit où stocker
 * formatContract/callbacks/openPromises : la planification reste bloquée pour ce mode (§1/§6), mais
 * l'état, lui, doit pouvoir exister pour porter ces réglages édités à la main (§7).
 */
export async function ensureNarrativeState(
  userId: string,
  params: { productId?: string | null; seriesId?: string | null }
): Promise<NarrativeStateDTO> {
  const productId = params.productId ?? null;
  const seriesId = params.seriesId ?? null;
  // Valide au passage l'existence/l'appartenance du sujet/série avant de créer quoi que ce soit.
  await resolveSubject(userId, productId, seriesId);

  const existing = await findNarrativeState(userId, productId, seriesId);
  if (existing) return existing;

  const [row] = await db.insert(narrativeState).values({ userId, productId, seriesId }).returning();
  return toNarrativeStateDTO(row);
}

/**
 * Ingestion d'un document de matière (§5) : marque `isStale` l'état du sujet lui-même (produit ou
 * marque) ET les états des séries liées à ce même sujet (`ContentSeries.productId`, sélecteur de
 * sujet) — une série sans sujet propre lit la matière de niveau marque (cf. resolveSubject), donc
 * un dépôt marque (productId null) rend aussi stale les séries sans sujet lié.
 */
export async function markStaleForMaterialIngestion(userId: string, productId: string | null): Promise<void> {
  await db
    .update(narrativeState)
    .set({ isStale: true, updatedAt: new Date() })
    .where(
      and(
        eq(narrativeState.userId, userId),
        productId ? eq(narrativeState.productId, productId) : isNull(narrativeState.productId),
        isNull(narrativeState.seriesId)
      )
    );

  const linkedSeries = await db.query.contentSeries.findMany({
    where: and(
      eq(contentSeries.userId, userId),
      productId ? eq(contentSeries.productId, productId) : isNull(contentSeries.productId)
    ),
    columns: { id: true },
  });
  if (linkedSeries.length === 0) return;

  await db
    .update(narrativeState)
    .set({ isStale: true, updatedAt: new Date() })
    .where(
      and(
        eq(narrativeState.userId, userId),
        isNull(narrativeState.productId),
        inArray(
          narrativeState.seriesId,
          linkedSeries.map((s) => s.id)
        )
      )
    );
}

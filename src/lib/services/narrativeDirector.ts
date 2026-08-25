import { z } from "zod";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { narrativeState, products, contentSeries, creatorProfiles, scripts, sourceMaterials, sourceMaterialCitations } from "@/db/schema";
import {
  planNarrative,
  type LlmNarrativeBeat,
  type NarrativePlanContext,
  type NarrativePlanDocumentContext,
} from "@/lib/llm/narrativePrompts";
import { backfillMaterialSummaries } from "@/lib/services/sourceMaterialService";
import { ApiError } from "@/lib/api/errors";

const MAX_FOCUS_DOCS = 3;
const MAX_CALLBACKS = 8;
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

async function resolveSubject(userId: string, productId: string | null, seriesId: string | null) {
  let product = null;
  if (productId) {
    product = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.userId, userId)) });
    if (!product) throw new ApiError(404, "Sujet introuvable.");
  }
  let series = null;
  if (seriesId) {
    series = await db.query.contentSeries.findFirst({ where: and(eq(contentSeries.id, seriesId), eq(contentSeries.userId, userId)) });
    if (!series) throw new ApiError(404, "Série introuvable.");
  }
  const subjectLabel = series?.label ?? product?.name ?? "l'activité de la marque";
  return { product, series, subjectLabel };
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
 */
function mergeBeats(existingBeats: NarrativeBeat[], llmBeats: LlmNarrativeBeat[]): NarrativeBeat[] {
  const existingById = new Map(existingBeats.map((b) => [b.id, b]));
  const seenIds = new Set<string>();
  const merged: NarrativeBeat[] = [];

  for (const llmBeat of llmBeats) {
    const existing = existingById.get(llmBeat.id);
    if (existing?.status === "published") {
      merged.push(existing);
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

  // Beats publiés omis par le LLM : conservés tels quels, rajoutés à la fin dans leur ordre relatif
  // d'origine — décision d'implémentation, la spec ne précise pas la position exacte pour ce cas
  // (le plafond de 20 beats et le retrait des plus anciens publiés au-delà sont différés au Lot B4,
  // §5/§8 — pas appliqués ici).
  for (const existing of existingBeats) {
    if (existing.status === "published" && !seenIds.has(existing.id)) {
      merged.push(existing);
    }
  }

  return merged;
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

  const { product, series, subjectLabel } = await resolveSubject(userId, productId, seriesId);

  if (series && series.mode === "rendez_vous") {
    throw new ApiError(409, "Cette série est en mode rendez-vous : chaque épisode est autonome, pas de plan à maintenir.");
  }

  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
  if (!profile) {
    throw new ApiError(400, "Configure d'abord ton profil créateur (Module A) avant de planifier.");
  }

  // Backfill paresseux (§3.1) : matière scopée par produit — une série sans produit associé (le
  // schéma ne porte pas ce lien ; le mécanisme "série depuis la matière" le reçoit en paramètre
  // indépendant) retombe sur la matière de niveau marque. Décision d'implémentation, non tranchée
  // explicitement par la spec.
  await backfillMaterialSummaries(userId, productId);

  const existing = await findNarrativeState(userId, productId, seriesId);
  const existingBeats = existing?.beats ?? [];
  const existingCallbacks = existing?.callbacks ?? [];

  const [documents, publishedConcepts] = await Promise.all([
    loadDocumentSummaries(userId, productId),
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
  const mergedBeats = mergeBeats(existingBeats, result.beats);
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

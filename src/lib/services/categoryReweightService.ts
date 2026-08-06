import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistantProposals, scripts } from "@/db/schema";
import { listActiveCategoriesForUser } from "@/lib/services/categoryLabelsService";

/**
 * Mécanique de re-pondération de ContentCategory.weight à partir des métriques auto
 * (docs/SPEC_METRIQUES_AUTO.md §6). Calcul déterministe pur (testable sans DB) :
 * computeCategoryPlatformSignals -> aggregateCategorySignals -> buildReweightItems.
 * La partie DB-aware (maybeGenerateCategoryReweightProposal) ne fait qu'assembler les données
 * et insérer l'AssistantProposal — jamais d'application directe (§7.4 : toujours par proposal).
 */

// En dessous, le couple (catégorie, plateforme) est ignoré — pas assez de volume pour un signal
// fiable. Volontairement plus haut que MIN_SAMPLES_FOR_SIGNAL=3 de performanceService.ts : ce
// dernier alimente une phrase de prompt réversible à chaque génération, la re-pondération modifie
// une donnée structurelle persistante — le bar doit être plus haut.
export const MIN_SAMPLES_PER_CATEGORY_PLATFORM = 5;
// Il faut au moins 2 catégories avec un signal comparable pour produire une proposition.
export const MIN_COMPARABLE_CATEGORIES = 2;
// Plafonne la contribution d'une plateforme à forte activité pour qu'elle ne noie pas le signal
// d'une plateforme à plus faible volume dans l'agrégation inter-plateforme d'une même catégorie.
export const PLATFORM_SAMPLE_CAP = 20;
// Points de pourcentage de delta par unité de z-score, avant plafond et amortissement.
export const SENSITIVITY = 4;
// Plafond dur par cycle — protège contre un pic ponctuel (post viral qui fausse μ/σ d'un coup).
export const MAX_DELTA_PER_CYCLE = 8;
// Fraction du delta théorique réellement appliquée — protège contre la dérive cumulative cycle
// après cycle même quand le signal reste vrai dans la durée (§6.2, risque d'emballement).
export const DAMPING_FACTOR = 0.5;
export const MIN_CATEGORY_WEIGHT = 10;
export const MAX_CATEGORY_WEIGHT = 90;
// Pas de nouvelle re-pondération générée dans les COOLDOWN_DAYS suivant la dernière (tout statut
// confondu, un rejet compte aussi comme "déjà demandé récemment") — évite de spammer l'utilisateur
// à chaque ouverture de /performance.
export const COOLDOWN_DAYS = 14;

export interface EngagementSample {
  categoryId: string;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface CategoryPlatformSignal {
  categoryId: string;
  platform: string;
  zAvg: number;
  sampleCount: number;
}

export interface CategorySignal {
  categoryId: string;
  categoryScore: number;
  sampleCount: number;
}

export interface CategoryWithWeight {
  id: string;
  label: string;
  weight: number;
}

export interface ReweightItem {
  targetId: string;
  label: string;
  previousWeight: number;
  proposedWeight: number;
  sampleCount: number;
  categoryScore: number;
}

function engagementRate(s: { views: number; likes: number; comments: number; shares: number }): number {
  return (s.likes + s.comments + s.shares) / Math.max(s.views, 1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Étape 1+2 : z-score de chaque échantillon par rapport à la moyenne/écart-type de SA
 *  plateforme (rend TikTok et LinkedIn comparables — §6.1), puis moyenne par (catégorie,
 *  plateforme). Couples sous MIN_SAMPLES_PER_CATEGORY_PLATFORM exclus (pas de signal). */
export function computeCategoryPlatformSignals(samples: EngagementSample[]): CategoryPlatformSignal[] {
  const byPlatform = new Map<string, EngagementSample[]>();
  for (const s of samples) {
    const arr = byPlatform.get(s.platform) ?? [];
    arr.push(s);
    byPlatform.set(s.platform, arr);
  }

  // Seuil en dessous duquel l'écart-type est traité comme nul : sans lui, un groupe à variance
  // réellement nulle mais entachée de bruit d'arrondi flottant (ex. 16 taux identiques dont la
  // moyenne par reduce() ne retombe pas bit-à-bit sur la valeur d'origine) produit un sd de l'ordre
  // de 1e-17 au lieu de 0 exactement, et diviser par ce quasi-zéro donne des z-scores parasites
  // d'ordre 1 au lieu de 0. Les taux d'engagement réels ne produisent jamais une variance aussi
  // infime à moins d'être rigoureusement constants.
  const SD_EPSILON = 1e-9;
  const buckets = new Map<string, { categoryId: string; platform: string; zs: number[] }>();
  for (const [platform, group] of byPlatform) {
    const rates = group.map(engagementRate);
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance = rates.reduce((a, r) => a + (r - mean) ** 2, 0) / rates.length;
    const sd = Math.sqrt(variance);

    group.forEach((s, i) => {
      const z = sd > SD_EPSILON ? (rates[i] - mean) / sd : 0;
      const key = `${platform}::${s.categoryId}`;
      const bucket = buckets.get(key) ?? { categoryId: s.categoryId, platform, zs: [] };
      bucket.zs.push(z);
      buckets.set(key, bucket);
    });
  }

  const signals: CategoryPlatformSignal[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.zs.length < MIN_SAMPLES_PER_CATEGORY_PLATFORM) continue;
    signals.push({
      categoryId: bucket.categoryId,
      platform: bucket.platform,
      zAvg: bucket.zs.reduce((a, b) => a + b, 0) / bucket.zs.length,
      sampleCount: bucket.zs.length,
    });
  }
  return signals;
}

/** Étape 3 : agrégation inter-plateforme par catégorie — nécessaire car ContentCategory.weight
 *  est un champ global, pas par plateforme (une catégorie suivie sur TikTok et LinkedIn n'a
 *  qu'un seul poids). Moyenne pondérée par échantillon, plafonnée à PLATFORM_SAMPLE_CAP par
 *  plateforme pour qu'un fort volume sur une plateforme ne noie pas le signal d'une autre. */
export function aggregateCategorySignals(platformSignals: CategoryPlatformSignal[]): CategorySignal[] {
  const byCategory = new Map<string, CategoryPlatformSignal[]>();
  for (const sig of platformSignals) {
    const arr = byCategory.get(sig.categoryId) ?? [];
    arr.push(sig);
    byCategory.set(sig.categoryId, arr);
  }

  const result: CategorySignal[] = [];
  for (const [categoryId, sigs] of byCategory) {
    let weightedSum = 0;
    let weightTotal = 0;
    let sampleTotal = 0;
    for (const s of sigs) {
      const cappedCount = Math.min(s.sampleCount, PLATFORM_SAMPLE_CAP);
      weightedSum += s.zAvg * cappedCount;
      weightTotal += cappedCount;
      sampleTotal += s.sampleCount;
    }
    result.push({
      categoryId,
      categoryScore: weightTotal > 0 ? weightedSum / weightTotal : 0,
      sampleCount: sampleTotal,
    });
  }
  return result;
}

/** Étape 4 : delta plafonné puis amorti, poids final borné à [MIN_CATEGORY_WEIGHT,
 *  MAX_CATEGORY_WEIGHT]. Le plafond protège contre un pic ponctuel, le damping contre la dérive
 *  cumulative cycle après cycle (§6.2 emballement). */
export function computeProposedWeight(currentWeight: number, categoryScore: number): number {
  const rawDelta = clamp(categoryScore * SENSITIVITY, -MAX_DELTA_PER_CYCLE, MAX_DELTA_PER_CYCLE);
  const appliedDelta = rawDelta * DAMPING_FACTOR;
  return clamp(Math.round(currentWeight + appliedDelta), MIN_CATEGORY_WEIGHT, MAX_CATEGORY_WEIGHT);
}

/** Assemble le payload complet d'une proposition de re-pondération : uniquement les catégories
 *  dont le poids proposé diffère du poids actuel après arrondi. Renvoie [] si moins de
 *  MIN_COMPARABLE_CATEGORIES catégories ont un signal exploitable (comparer une seule catégorie
 *  à rien n'a pas de sens — même garde-fou que performanceService.ts). */
export function buildReweightItems(categories: CategoryWithWeight[], samples: EngagementSample[]): ReweightItem[] {
  const platformSignals = computeCategoryPlatformSignals(samples);
  const categorySignals = aggregateCategorySignals(platformSignals);
  if (categorySignals.length < MIN_COMPARABLE_CATEGORIES) return [];

  const byCategory = new Map(categorySignals.map((s) => [s.categoryId, s]));

  const items: ReweightItem[] = [];
  for (const category of categories) {
    const signal = byCategory.get(category.id);
    if (!signal) continue; // pas de signal suffisant pour cette catégorie -> poids inchangé
    const proposedWeight = computeProposedWeight(category.weight, signal.categoryScore);
    if (proposedWeight === category.weight) continue; // delta nul après arrondi -> absent du payload
    items.push({
      targetId: category.id,
      label: category.label,
      previousWeight: category.weight,
      proposedWeight,
      sampleCount: signal.sampleCount,
      categoryScore: signal.categoryScore,
    });
  }
  return items;
}

/** Texte déterministe résumant le sens de la proposition — affiché en tête de carte dans
 *  AssistantProposalsPanel. Pas d'appel LLM (même esprit que performanceService.ts). */
export function buildReasonSummary(items: ReweightItem[]): string {
  const up = [...items].filter((i) => i.proposedWeight > i.previousWeight).sort((a, b) => b.categoryScore - a.categoryScore);
  const down = [...items].filter((i) => i.proposedWeight < i.previousWeight).sort((a, b) => a.categoryScore - b.categoryScore);

  const parts: string[] = [];
  if (up.length > 0) parts.push(`${up.map((i) => `« ${i.label} »`).join(", ")} engage mieux que la moyenne récente`);
  if (down.length > 0) parts.push(`${down.map((i) => `« ${i.label} »`).join(", ")} engage moins bien`);

  return parts.length > 0
    ? `Sur la base des métriques récupérées automatiquement : ${parts.join(" ; ")}.`
    : "Rééquilibrage proposé sur la base des métriques récentes.";
}

/** Point d'entrée DB-aware, appelé en fin de fetch de métriques (postMetricsFetchService.ts).
 *  N'insère une AssistantProposal que si au moins un delta est non nul et si le cooldown est
 *  passé. Ne s'applique jamais seule : passe systématiquement par la validation utilisateur
 *  (docs/SPEC_METRIQUES_AUTO.md §7.4). */
export async function maybeGenerateCategoryReweightProposal(userId: string): Promise<void> {
  const lastReweight = await db.query.assistantProposals.findFirst({
    where: and(eq(assistantProposals.userId, userId), eq(assistantProposals.kind, "category_reweight")),
    orderBy: [desc(assistantProposals.createdAt)],
  });
  if (lastReweight) {
    const daysSinceLast = (Date.now() - lastReweight.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLast < COOLDOWN_DAYS) return;
  }

  const [categories, scriptRows] = await Promise.all([
    listActiveCategoriesForUser(userId),
    db.query.scripts.findMany({
      where: eq(scripts.userId, userId),
      columns: { contentCategoryId: true, platform: true },
      with: { metrics: true },
    }),
  ]);

  // La re-pondération automatique ne considère jamais la saisie manuelle non vérifiée — seules
  // les métriques confirmées via le flow de matching (source="api") alimentent le signal.
  const samples: EngagementSample[] = scriptRows
    .filter((s) => s.metrics && s.metrics.source === "api")
    .map((s) => ({
      categoryId: s.contentCategoryId,
      platform: s.platform,
      views: s.metrics!.views,
      likes: s.metrics!.likes,
      comments: s.metrics!.comments,
      shares: s.metrics!.shares,
    }));

  const items = buildReweightItems(categories, samples);
  if (items.length === 0) return;

  await db.insert(assistantProposals).values({
    userId,
    kind: "category_reweight",
    targetId: null,
    payload: { items, reasonSummary: buildReasonSummary(items) },
  });
}

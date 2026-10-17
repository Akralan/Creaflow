import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistantProposals, scripts } from "@/db/schema";
import { listActiveCategoriesForUser } from "@/lib/services/categoryLabelsService";

/**
 * Mechanics for reweighting ContentCategory.weight from the automatic metrics
 * (docs/SPEC_METRIQUES_AUTO.md §6). Pure deterministic calculation (testable without a DB):
 * computeCategoryPlatformSignals -> aggregateCategorySignals -> buildReweightItems.
 * The DB-aware part (maybeGenerateCategoryReweightProposal) only assembles the data
 * and inserts the AssistantProposal — never a direct application (§7.4: always through a proposal).
 */

// Below this, the (category, platform) pair is ignored — not enough volume for a reliable
// signal. Deliberately higher than MIN_SAMPLES_FOR_SIGNAL=3 in performanceService.ts: the
// latter feeds a reversible prompt sentence at each generation, reweighting modifies
// persistent structural data — the bar must be higher.
export const MIN_SAMPLES_PER_CATEGORY_PLATFORM = 5;
// At least 2 categories with a comparable signal are needed to produce a proposal.
export const MIN_COMPARABLE_CATEGORIES = 2;
// Caps the contribution of a high-activity platform so that it does not drown the signal
// of a lower-volume platform in the cross-platform aggregation of the same category.
export const PLATFORM_SAMPLE_CAP = 20;
// Percentage points of delta per z-score unit, before capping and damping.
export const SENSITIVITY = 4;
// Hard cap per cycle — protects against a one-off spike (viral post that skews μ/σ all at once).
export const MAX_DELTA_PER_CYCLE = 8;
// Fraction of the theoretical delta actually applied — protects against cumulative drift cycle
// after cycle even when the signal stays true over time (§6.2, runaway risk).
export const DAMPING_FACTOR = 0.5;
export const MIN_CATEGORY_WEIGHT = 10;
export const MAX_CATEGORY_WEIGHT = 90;
// No new reweighting generated within the COOLDOWN_DAYS following the last one (any status
// included, a rejection also counts as "already requested recently") — avoids spamming the user
// on every opening of /performance.
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

/** Steps 1+2: z-score of each sample relative to the mean/standard deviation of ITS
 *  platform (makes Instagram and LinkedIn comparable — §6.1), then mean per (category,
 *  platform). Pairs under MIN_SAMPLES_PER_CATEGORY_PLATFORM excluded (no signal). */
export function computeCategoryPlatformSignals(samples: EngagementSample[]): CategoryPlatformSignal[] {
  const byPlatform = new Map<string, EngagementSample[]>();
  for (const s of samples) {
    const arr = byPlatform.get(s.platform) ?? [];
    arr.push(s);
    byPlatform.set(s.platform, arr);
  }

  // Threshold below which the standard deviation is treated as zero: without it, a group with
  // truly zero variance but tainted by floating-point rounding noise (e.g. 16 identical rates whose
  // mean via reduce() does not land bit-for-bit on the original value) produces an sd of the order
  // of 1e-17 instead of exactly 0, and dividing by that near-zero gives spurious z-scores
  // of order 1 instead of 0. Real engagement rates never produce a variance this
  // tiny unless they are strictly constant.
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

/** Step 3: cross-platform aggregation per category — necessary because ContentCategory.weight
 *  is a global field, not per platform (a category tracked on Instagram and LinkedIn has
 *  only one weight). Sample-weighted mean, capped at PLATFORM_SAMPLE_CAP per
 *  platform so that high volume on one platform does not drown another's signal. */
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

/** Step 4: capped then damped delta, final weight bounded to [MIN_CATEGORY_WEIGHT,
 *  MAX_CATEGORY_WEIGHT]. The cap protects against a one-off spike, damping against cumulative
 *  drift cycle after cycle (§6.2 runaway). */
export function computeProposedWeight(currentWeight: number, categoryScore: number): number {
  const rawDelta = clamp(categoryScore * SENSITIVITY, -MAX_DELTA_PER_CYCLE, MAX_DELTA_PER_CYCLE);
  const appliedDelta = rawDelta * DAMPING_FACTOR;
  return clamp(Math.round(currentWeight + appliedDelta), MIN_CATEGORY_WEIGHT, MAX_CATEGORY_WEIGHT);
}

/** Assembles the complete payload of a reweighting proposal: only the categories
 *  whose proposed weight differs from the current weight after rounding. Returns [] if fewer than
 *  MIN_COMPARABLE_CATEGORIES categories have a usable signal (comparing a single category
 *  to nothing makes no sense — same safeguard as performanceService.ts). */
export function buildReweightItems(categories: CategoryWithWeight[], samples: EngagementSample[]): ReweightItem[] {
  const platformSignals = computeCategoryPlatformSignals(samples);
  const categorySignals = aggregateCategorySignals(platformSignals);
  if (categorySignals.length < MIN_COMPARABLE_CATEGORIES) return [];

  const byCategory = new Map(categorySignals.map((s) => [s.categoryId, s]));

  const items: ReweightItem[] = [];
  for (const category of categories) {
    const signal = byCategory.get(category.id);
    if (!signal) continue; // not enough signal for this category -> weight unchanged
    const proposedWeight = computeProposedWeight(category.weight, signal.categoryScore);
    if (proposedWeight === category.weight) continue; // zero delta after rounding -> absent from the payload
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

/** Deterministic text summarising the meaning of the proposal — displayed at the top of the card in
 *  AssistantProposalsPanel. No LLM call (same spirit as performanceService.ts). */
export function buildReasonSummary(items: ReweightItem[]): string {
  const up = [...items].filter((i) => i.proposedWeight > i.previousWeight).sort((a, b) => b.categoryScore - a.categoryScore);
  const down = [...items].filter((i) => i.proposedWeight < i.previousWeight).sort((a, b) => a.categoryScore - b.categoryScore);

  const parts: string[] = [];
  if (up.length > 0) parts.push(`${up.map((i) => `"${i.label}"`).join(", ")} ${up.length > 1 ? "are" : "is"} engaging better than the recent average`);
  if (down.length > 0) parts.push(`${down.map((i) => `"${i.label}"`).join(", ")} ${down.length > 1 ? "are" : "is"} engaging less well`);

  return parts.length > 0
    ? `Based on the automatically retrieved metrics: ${parts.join("; ")}.`
    : "Rebalancing proposed based on recent metrics.";
}

/** DB-aware entry point, called at the end of a metrics fetch (postMetricsFetchService.ts).
 *  Only inserts an AssistantProposal if at least one delta is non-zero and the cooldown has
 *  passed. Never applies on its own: always goes through user validation.
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

  // Automatic reweighting never considers unverified manual entry — only
  // metrics confirmed via the matching flow (source="api") feed the signal.
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

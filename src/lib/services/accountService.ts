import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assistantAttachments,
  assistantProposals,
  assistantSessions,
  brandAssets,
  calendarEntries,
  contentAngles,
  contentCategories,
  contentCategoriesPlatforms,
  contentSeries,
  contentSeriesCategories,
  contentSeriesPlatforms,
  creatorProfiles,
  googleDriveConnections,
  inspirationVideos,
  inspirations,
  materialSources,
  narrativeState,
  oauthAccounts,
  postMetrics,
  postMetricsSnapshots,
  postingGoals,
  products,
  scripts,
  socialConnections,
  sourceMaterialCitations,
  sourceMaterials,
  subjectInterviewSessions,
  subscriptions,
  users,
  visualDesigns,
} from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { getStripeClient } from "@/lib/billing/stripeClient";
import { sendEmail } from "@/lib/email";
import { accountDeletedEmail } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { getObjectStorage, isObjectStorageConfigured } from "@/lib/storage";
import { NON_TERMINAL_SUBSCRIPTION_STATUSES, getSubscriptionForUser } from "@/lib/services/billingService";
import { listConnectedProviders } from "@/lib/services/oauthAccountService";

/** What the Account tab displays (docs/SPEC_LEGAL_EMAIL_RGPD.md §4.1). */
export interface AccountSummary {
  email: string;
  createdAt: Date;
  providers: Array<{ id: string; displayName: string }>;
}

export async function getAccountSummary(userId: string): Promise<AccountSummary> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, createdAt: true },
  });
  if (!user) throw new ApiError(404, "Account not found.");
  return {
    email: user.email,
    createdAt: user.createdAt,
    providers: await listConnectedProviders(userId),
  };
}

/**
 * Confirmation before deletion: re-typing the address (§4.2 ; there is no password any more,
 * docs/SPEC_CONNEXION_PAR_LIEN.md). The session is not enough — a tab left open must not allow
 * erasing an account in one click.
 */
export async function assertDeletionConfirmed(userId: string, confirmation: { emailConfirmation?: string }): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true },
  });
  if (!user) throw new ApiError(404, "Account not found.");

  if (!matchesEmailConfirmation(user.email, confirmation.emailConfirmation)) {
    throw new ApiError(400, "The address entered does not match the account's.");
  }
}

export function matchesEmailConfirmation(accountEmail: string, typed: string | undefined): boolean {
  return Boolean(typed) && typed!.trim().toLowerCase() === accountEmail.toLowerCase();
}

/**
 * End-to-end deletion, in the order of spec §4.2: Stripe first (blocking — we don't delete an
 * account we would keep billing), then the database (cascade on all user tables), and only then
 * R2 — the keys are read beforehand, because they go away with the cascade. If the database
 * deletion fails, the account stays whole with its images: orphan objects in R2 are better than
 * a live account with missing parts. The confirmation email closes the sequence.
 */
export async function deleteAccount(userId: string): Promise<{ email: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } });
  if (!user) throw new ApiError(404, "Account not found.");

  await cancelStripeSubscription(userId);
  const storageKeys = await listStoredObjectKeys(userId);

  await db.delete(users).where(eq(users.id, userId));
  logger.info("Account deleted", { userId });

  await deleteStoredObjects(userId, storageKeys);

  try {
    await sendEmail({ to: user.email, ...accountDeletedEmail() });
  } catch (error) {
    logger.error("Failed to send the account deletion confirmation", error, { userId });
  }
  return { email: user.email };
}

async function cancelStripeSubscription(userId: string): Promise<void> {
  const subscription = await getSubscriptionForUser(userId);
  if (!subscription) return;
  const stripe = getStripeClient();

  // A subscription already in a terminal status has nothing to cancel.
  if (subscription.stripeSubscriptionId && NON_TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    try {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } catch (error) {
      logger.error("Stripe cancellation failed during account deletion", error, { userId });
      throw new ApiError(502, "Unable to cancel the subscription right now. Please try again in a few moments.");
    }
  }
  // The Stripe customer and its invoices remain (accounting obligation); we only note that the
  // app account no longer exists — best effort, it must not block the deletion.
  try {
    await stripe.customers.update(subscription.stripeCustomerId, {
      metadata: { creaflowAccountDeletedAt: new Date().toISOString() },
    });
  } catch (error) {
    logger.warn("Could not annotate the Stripe customer during account deletion", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Original (uploads), thumbnail and cached background-removed version of each photo (docs/SPEC_COMPOSITION_VISUELLE.md).
async function listStoredObjectKeys(userId: string): Promise<string[]> {
  const assets = await db
    .select({ originalKey: brandAssets.originalKey, thumbnailKey: brandAssets.thumbnailKey, cutoutKey: brandAssets.cutoutKey })
    .from(brandAssets)
    .where(eq(brandAssets.userId, userId));
  return assets.flatMap((a) => [a.originalKey, a.thumbnailKey, a.cutoutKey]).filter((k): k is string => Boolean(k));
}

async function deleteStoredObjects(userId: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  if (!isObjectStorageConfigured()) {
    logger.warn("Object storage not configured: objects not deleted with the account", { userId, count: keys.length });
    return;
  }
  const storage = getObjectStorage();
  for (const key of keys) {
    try {
      await storage.delete(key);
    } catch (error) {
      logger.error("Deleting an R2 object failed during account deletion", error, { userId, key });
    }
  }
}

/**
 * Export for data portability (§4.3): all the account's tables, without OAuth tokens or
 * embeddings; images are referenced by their public URL, not embedded.
 */
export async function exportAccountData(userId: string): Promise<Record<string, unknown>> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, vertical: true, createdAt: true },
  });
  if (!user) throw new ApiError(404, "Account not found.");

  const [
    profile,
    productRows,
    sourceRows,
    materialRows,
    categoryRows,
    angleRows,
    seriesRows,
    scriptRows,
    calendarRows,
    goalRows,
    narrativeRows,
    citationRows,
    assetRows,
    designRows,
    inspirationRows,
    subjectInspirationRows,
    assistantRows,
    interviewRows,
    attachmentRows,
    proposalRows,
    socialRows,
    driveRows,
    oauthRows,
    subscriptionRows,
  ] = await Promise.all([
    db.select().from(creatorProfiles).where(eq(creatorProfiles.userId, userId)),
    db.select().from(products).where(eq(products.userId, userId)),
    db.select().from(materialSources).where(eq(materialSources.userId, userId)),
    db.select().from(sourceMaterials).where(eq(sourceMaterials.userId, userId)),
    db.select().from(contentCategories).where(eq(contentCategories.userId, userId)),
    db.select().from(contentAngles).where(eq(contentAngles.userId, userId)),
    db.select().from(contentSeries).where(eq(contentSeries.userId, userId)),
    db.select().from(scripts).where(eq(scripts.userId, userId)),
    db.select().from(calendarEntries).where(eq(calendarEntries.userId, userId)),
    db.select().from(postingGoals).where(eq(postingGoals.userId, userId)),
    db.select().from(narrativeState).where(eq(narrativeState.userId, userId)),
    db.select().from(sourceMaterialCitations).where(eq(sourceMaterialCitations.userId, userId)),
    db.select().from(brandAssets).where(eq(brandAssets.userId, userId)),
    db.select().from(visualDesigns).where(eq(visualDesigns.userId, userId)),
    db.select().from(inspirationVideos).where(eq(inspirationVideos.userId, userId)),
    db.select().from(inspirations).where(eq(inspirations.userId, userId)),
    db.select().from(assistantSessions).where(eq(assistantSessions.userId, userId)),
    db.select().from(subjectInterviewSessions).where(eq(subjectInterviewSessions.userId, userId)),
    db.select().from(assistantAttachments).where(eq(assistantAttachments.userId, userId)),
    db.select().from(assistantProposals).where(eq(assistantProposals.userId, userId)),
    db
      .select({
        platform: socialConnections.platform,
        status: socialConnections.status,
        platformUserId: socialConnections.platformUserId,
        connectedAt: socialConnections.connectedAt,
      })
      .from(socialConnections)
      .where(eq(socialConnections.userId, userId)),
    db
      .select({
        driveAccountEmail: googleDriveConnections.driveAccountEmail,
        status: googleDriveConnections.status,
        connectedAt: googleDriveConnections.connectedAt,
      })
      .from(googleDriveConnections)
      .where(eq(googleDriveConnections.userId, userId)),
    db
      .select({
        provider: oauthAccounts.provider,
        login: oauthAccounts.login,
        name: oauthAccounts.name,
        scope: oauthAccounts.scope,
        connectedAt: oauthAccounts.connectedAt,
      })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId)),
    db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId)),
  ]);

  const scriptIds = scriptRows.map((s) => s.id);
  const seriesIds = seriesRows.map((s) => s.id);
  const categoryIds = categoryRows.map((c) => c.id);
  const [metricRows, snapshotRows, seriesCategoryRows, seriesPlatformRows, categoryPlatformRows] = await Promise.all([
    scriptIds.length ? db.select().from(postMetrics).where(inArray(postMetrics.scriptId, scriptIds)) : [],
    scriptIds.length ? db.select().from(postMetricsSnapshots).where(inArray(postMetricsSnapshots.scriptId, scriptIds)) : [],
    seriesIds.length ? db.select().from(contentSeriesCategories).where(inArray(contentSeriesCategories.seriesId, seriesIds)) : [],
    seriesIds.length ? db.select().from(contentSeriesPlatforms).where(inArray(contentSeriesPlatforms.seriesId, seriesIds)) : [],
    categoryIds.length
      ? db.select().from(contentCategoriesPlatforms).where(inArray(contentCategoriesPlatforms.categoryId, categoryIds))
      : [],
  ]);

  const publicUrl = (key: string | null) => (key && isObjectStorageConfigured() ? getObjectStorage().getPublicUrl(key) : null);

  return {
    exportedAt: new Date().toISOString(),
    format: "creaflow-export/1",
    account: user,
    profile: profile[0] ?? null,
    subjects: productRows,
    materialSources: sourceRows,
    materials: materialRows,
    categories: categoryRows,
    categoryPlatforms: categoryPlatformRows,
    angles: angleRows,
    series: seriesRows,
    seriesCategories: seriesCategoryRows,
    seriesPlatforms: seriesPlatformRows,
    scripts: scriptRows,
    citations: citationRows,
    narrative: narrativeRows,
    calendar: calendarRows,
    postingGoals: goalRows,
    postMetrics: metricRows,
    postMetricsSnapshots: snapshotRows,
    // Without the embedding (768 floats per image, unusable outside the app).
    visualAssets: assetRows.map((row) => {
      const { embedding, ...asset } = row;
      void embedding;
      return {
        ...asset,
        originalUrl: publicUrl(asset.originalKey),
        thumbnailUrl: publicUrl(asset.thumbnailKey),
        cutoutUrl: publicUrl(asset.cutoutKey),
      };
    }),
    visualDesigns: designRows,
    // Per-topic inspiration watch cards (docs/SPEC_MEMOIRE_ET_VEILLE.md §3).
    subjectInspirations: subjectInspirationRows,
    inspirationVideos: inspirationRows,
    assistantConversation: assistantRows,
    interviews: interviewRows,
    assistantAttachments: attachmentRows,
    assistantProposals: proposalRows,
    connections: { social: socialRows, googleDrive: driveRows, identityProviders: oauthRows },
    subscription: subscriptionRows[0] ?? null,
  };
}

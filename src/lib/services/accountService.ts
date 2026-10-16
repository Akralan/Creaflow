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
  materialSources,
  narrativeState,
  oauthAccounts,
  onboardingSessions,
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
import { verifyPassword } from "@/lib/auth/password";
import { getStripeClient } from "@/lib/billing/stripeClient";
import { sendEmail } from "@/lib/email";
import { accountDeletedEmail } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { getObjectStorage, isObjectStorageConfigured } from "@/lib/storage";
import { NON_TERMINAL_SUBSCRIPTION_STATUSES, getSubscriptionForUser } from "@/lib/services/billingService";
import { listConnectedProviders } from "@/lib/services/oauthAccountService";

/** Ce que l'onglet Compte affiche (docs/SPEC_LEGAL_EMAIL_RGPD.md §4.1). */
export interface AccountSummary {
  email: string;
  createdAt: Date;
  /** Faux pour un compte créé via GitHub/Notion/Linear qui n'a jamais défini de mot de passe. */
  hasPassword: boolean;
  providers: Array<{ id: string; displayName: string }>;
}

export async function getAccountSummary(userId: string): Promise<AccountSummary> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, createdAt: true, passwordHash: true },
  });
  if (!user) throw new ApiError(404, "Compte introuvable.");
  return {
    email: user.email,
    createdAt: user.createdAt,
    hasPassword: Boolean(user.passwordHash),
    providers: await listConnectedProviders(userId),
  };
}

/**
 * Confirmation avant suppression : le mot de passe quand le compte en a un, la recopie de l'adresse
 * sinon (§4.2). La session ne suffit pas — un onglet laissé ouvert ne doit pas permettre d'effacer
 * un compte en un clic.
 */
export async function assertDeletionConfirmed(
  userId: string,
  confirmation: { password?: string; emailConfirmation?: string }
): Promise<void> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, passwordHash: true },
  });
  if (!user) throw new ApiError(404, "Compte introuvable.");

  if (user.passwordHash) {
    if (!confirmation.password || !(await verifyPassword(confirmation.password, user.passwordHash))) {
      throw new ApiError(400, "Mot de passe incorrect.");
    }
    return;
  }
  if (!matchesEmailConfirmation(user.email, confirmation.emailConfirmation)) {
    throw new ApiError(400, "L'adresse saisie ne correspond pas à celle du compte.");
  }
}

export function matchesEmailConfirmation(accountEmail: string, typed: string | undefined): boolean {
  return Boolean(typed) && typed!.trim().toLowerCase() === accountEmail.toLowerCase();
}

/**
 * Suppression de bout en bout, dans l'ordre de la spec §4.2 : Stripe d'abord (bloquant — on ne
 * supprime pas un compte qu'on continuerait à facturer), puis la base (cascade sur toutes les
 * tables utilisateur), puis seulement R2 — les clés sont lues avant, parce qu'elles partent avec
 * la cascade. Si la suppression en base échoue, le compte reste entier avec ses images : des objets
 * orphelins dans R2 valent mieux qu'un compte vivant amputé. L'email de confirmation ferme la marche.
 */
export async function deleteAccount(userId: string): Promise<{ email: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } });
  if (!user) throw new ApiError(404, "Compte introuvable.");

  await cancelStripeSubscription(userId);
  const storageKeys = await listStoredObjectKeys(userId);

  await db.delete(users).where(eq(users.id, userId));
  logger.info("Compte supprimé", { userId });

  await deleteStoredObjects(userId, storageKeys);

  try {
    await sendEmail({ to: user.email, ...accountDeletedEmail() });
  } catch (error) {
    logger.error("Échec d'envoi de la confirmation de suppression de compte", error, { userId });
  }
  return { email: user.email };
}

async function cancelStripeSubscription(userId: string): Promise<void> {
  const subscription = await getSubscriptionForUser(userId);
  if (!subscription) return;
  const stripe = getStripeClient();

  // Un abonnement déjà dans un statut terminal n'a rien à résilier.
  if (subscription.stripeSubscriptionId && NON_TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    try {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } catch (error) {
      logger.error("Résiliation Stripe impossible pendant la suppression du compte", error, { userId });
      throw new ApiError(502, "Impossible de résilier l'abonnement pour le moment. Réessaie dans quelques instants.");
    }
  }
  // Le client Stripe et ses factures restent (obligation comptable) ; on note seulement que le
  // compte applicatif n'existe plus — au mieux, ça ne doit pas bloquer la suppression.
  try {
    await stripe.customers.update(subscription.stripeCustomerId, {
      metadata: { creaflowAccountDeletedAt: new Date().toISOString() },
    });
  } catch (error) {
    logger.warn("Annotation du client Stripe impossible pendant la suppression du compte", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Original (uploads), vignette et détourage en cache de chaque photo (docs/SPEC_COMPOSITION_VISUELLE.md).
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
    logger.warn("Stockage objet non configuré : objets non supprimés avec le compte", { userId, count: keys.length });
    return;
  }
  const storage = getObjectStorage();
  for (const key of keys) {
    try {
      await storage.delete(key);
    } catch (error) {
      logger.error("Suppression d'un objet R2 échouée pendant la suppression du compte", error, { userId, key });
    }
  }
}

/**
 * Export au titre de la portabilité (§4.3) : toutes les tables du compte, sans les jetons OAuth ni
 * les embeddings ; les images sont référencées par leur URL publique, pas embarquées.
 */
export async function exportAccountData(userId: string): Promise<Record<string, unknown>> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, vertical: true, createdAt: true },
  });
  if (!user) throw new ApiError(404, "Compte introuvable.");

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
    onboardingRows,
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
    db.select().from(onboardingSessions).where(eq(onboardingSessions.userId, userId)),
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
    // Sans l'embedding (768 flottants par image, inutilisables hors de l'app).
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
    inspirationVideos: inspirationRows,
    onboardingConversation: onboardingRows,
    assistantConversation: assistantRows,
    interviews: interviewRows,
    assistantAttachments: attachmentRows,
    assistantProposals: proposalRows,
    connections: { social: socialRows, googleDrive: driveRows, identityProviders: oauthRows },
    subscription: subscriptionRows[0] ?? null,
  };
}

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  real,
  pgEnum,
  unique,
  vector,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const scriptStatusEnum = pgEnum("script_status", ["draft", "planned", "shot", "published"]);
export const contentTypeEnum = pgEnum("content_type", ["video", "visual", "text"]);
export const calendarStatusEnum = pgEnum("calendar_status", ["planned", "shot", "published"]);
export const onboardingStatusEnum = pgEnum("onboarding_status", ["in_progress", "complete"]);
export const assistantProposalKindEnum = pgEnum("assistant_proposal_kind", [
  "product_create",
  "product_update",
  "series_create",
  "series_update",
  "category_create",
  "category_update",
  "angle_create",
  "angle_update",
  "posting_goal_update",
  // Rééquilibrage batch de ContentCategory.weight à partir des métriques auto (docs/SPEC_METRIQUES_AUTO.md
  // §6/§7.4) — généré par un calcul déterministe (categoryReweightService.ts), pas par le LLM. targetId
  // reste null comme posting_goal_update : le payload porte la liste des catégories touchées.
  "category_reweight",
]);
export const assistantProposalStatusEnum = pgEnum("assistant_proposal_status", ["pending", "accepted", "rejected"]);
export const brandAssetSourceEnum = pgEnum("brand_asset_source", ["upload", "google_drive"]);
export const brandAssetStatusEnum = pgEnum("brand_asset_status", ["pending", "ready", "unreachable"]);
export const brandAssetOrientationEnum = pgEnum("brand_asset_orientation", ["portrait", "landscape", "square"]);
export const googleDriveConnectionStatusEnum = pgEnum("google_drive_connection_status", ["ok", "needs_reconnect"]);
export const generatedImageStatusEnum = pgEnum("generated_image_status", ["ready", "failed"]);
export const socialConnectionStatusEnum = pgEnum("social_connection_status", ["ok", "needs_reconnect"]);
export const postMetricsSourceEnum = pgEnum("post_metrics_source", ["manual", "api"]);
export const postMatchCandidateStatusEnum = pgEnum("post_match_candidate_status", ["pending", "confirmed", "dismissed"]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["starter", "pro"]);
// Sous-ensemble des statuts Stripe (Subscription.status) réellement distingués côté produit —
// "paused" n'est pas utilisé (pas de fonctionnalité de pause self-service en v1). Le webhook
// (src/app/api/billing/webhook/route.ts) rejette explicitement toute valeur hors de cette liste
// plutôt que de la stocker telle quelle.
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const onboardingSessions = pgTable("onboarding_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  messages: jsonb("messages").notNull(),
  extractedProfile: jsonb("extracted_profile"),
  status: onboardingStatusEnum("status").notNull().default("in_progress"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assistantSessions = pgTable("assistant_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  messages: jsonb("messages").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const assistantProposals = pgTable("assistant_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: assistantProposalKindEnum("kind").notNull(),
  // Pas de FK : référence conditionnellement products.id / contentSeries.id / contentCategories.id /
  // contentAngles.id selon `kind`. Toujours null pour category_create, angle_create et posting_goal_update
  // (la fréquence par plateforme n'a pas de notion de ligne cible : le payload contient le platform).
  targetId: uuid("target_id"),
  payload: jsonb("payload").notNull(),
  status: assistantProposalStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const creatorProfiles = pgTable("creator_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  brandName: text("brand_name").notNull(),
  activityType: text("activity_type").notNull(),
  tone: text("tone"),
  values: text("values"),
  equipment: text("equipment").array(),
  weeklyTimeAvailable: text("weekly_time_available"),
  styleProfile: jsonb("style_profile"),
  styleProfileUpdatedAt: timestamp("style_profile_updated_at"),
});

export const contentCategories = pgTable("content_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description").notNull(),
  weight: integer("weight").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contentAngles = pgTable("content_angles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contentSeries = pgTable("content_series", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  description: text("description").notNull(),
  // Pourcentage cible ABSOLU de créneaux, PAS normalisé à 100 comme contentCategories.weight —
  // la couverture série n'est jamais forcée à 100%.
  weight: integer("weight").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contentSeriesCategories = pgTable(
  "content_series_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id").notNull().references(() => contentSeries.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => contentCategories.id, { onDelete: "cascade" }),
  },
  (t) => [unique().on(t.seriesId, t.categoryId)]
);

// Aucune ligne pour une catégorie = visible sur tous les réseaux (comportement historique,
// rétrocompatible sans backfill).
export const contentCategoriesPlatforms = pgTable(
  "content_categories_platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id").notNull().references(() => contentCategories.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
  },
  (t) => [unique().on(t.categoryId, t.platform)]
);

// Aucune ligne pour une série = visible sur tous les réseaux (comportement historique,
// rétrocompatible sans backfill).
export const contentSeriesPlatforms = pgTable(
  "content_series_platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id").notNull().references(() => contentSeries.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
  },
  (t) => [unique().on(t.seriesId, t.platform)]
);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  valueProposition: text("value_proposition"),
  photoUrl: text("photo_url"),
});

// Bibliothèque de ressources visuelles (docs/SPEC_RESSOURCES_VISUELLES.md). Les images sources ne
// sont stockées que pour sourceType="upload" (originalKey) ; pour "google_drive", elles restent dans
// le Drive de l'utilisateur et sont relues à la demande via l'API Drive (fileId = externalId).
export const brandAssets = pgTable("brand_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceType: brandAssetSourceEnum("source_type").notNull(),
  externalId: text("external_id"), // Drive fileId ; null pour un upload direct
  sourceCheckedAt: timestamp("source_checked_at"),
  checksum: text("checksum").notNull(), // md5Checksum Drive, ou sha256 calculé à l'upload
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  originalKey: text("original_key"), // clé objet R2 de l'original — rempli seulement pour sourceType="upload"
  thumbnailKey: text("thumbnail_key"), // null tant que status="pending"
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  aiDescription: text("ai_description"),
  tags: text("tags").array(),
  orientation: brandAssetOrientationEnum("orientation"),
  hasEmbeddedText: boolean("has_embedded_text"),
  embedding: vector("embedding", { dimensions: 768 }),
  status: brandAssetStatusEnum("status").notNull().default("pending"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Connexion Google Drive (scope drive.file, via Google Picker) — distincte de socialConnections
// qui ne couvre que tiktok/instagram/linkedin. Un seul refresh token par utilisateur, conservé pour
// l'usage différé (files.get au captioning et à la génération d'image).
export const googleDriveConnections = pgTable("google_drive_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
  driveAccountEmail: text("drive_account_email"),
  status: googleDriveConnectionStatusEnum("status").notNull().default("ok"),
  lastCheckedAt: timestamp("last_checked_at"),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});

export const socialConnections = pgTable("social_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  // Nullable : certains providers (ex. Instagram long-lived token) n'exposent pas d'expiration
  // exploitable au même format que les autres — dans ce cas pas de refresh proactif possible,
  // l'appel API échoue explicitement le cas échéant (cf. socialConnectionService.ts).
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  status: socialConnectionStatusEnum("status").notNull().default("ok"),
  // Sert de repère pour la cadence de fetch (dédup 24h sur X, docs/SPEC_METRIQUES_AUTO.md §2.5).
  lastMetricsFetchAt: timestamp("last_metrics_fetch_at"),
  platformUserId: text("platform_user_id").notNull(),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});

export const inspirationVideos = pgTable("inspiration_videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  externalUrl: text("external_url").notNull(),
  captionText: text("caption_text"),
  metadata: jsonb("metadata"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

export const scripts = pgTable("scripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  platform: text("platform").notNull(),
  title: text("title").notNull(),
  hookVisual: text("hook_visual"),
  hookText: text("hook_text"),
  hookAudio: text("hook_audio"),
  storyboard: jsonb("storyboard"),
  caption: text("caption"),
  hashtags: text("hashtags").array(),
  soundRecommendation: text("sound_recommendation"),
  contentCategoryId: uuid("content_category_id").notNull().references(() => contentCategories.id),
  angleId: uuid("angle_id").references(() => contentAngles.id, { onDelete: "set null" }),
  seriesId: uuid("series_id").references(() => contentSeries.id, { onDelete: "set null" }),
  contentType: contentTypeEnum("content_type").notNull().default("video"),
  status: scriptStatusEnum("status").notNull().default("draft"),
  // Image de marque sélectionnée par recherche sémantique comme référence pour ce script (contentType
  // "visual"), et image effectivement générée à partir d'elle le cas échéant.
  brandAssetId: uuid("brand_asset_id").references(() => brandAssets.id, { onDelete: "set null" }),
  // Référence circulaire scripts <-> generatedImages : annotation de retour explicite requise pour
  // que TypeScript casse le cycle d'inférence (pattern documenté de drizzle-orm).
  generatedImageId: uuid("generated_image_id").references((): AnyPgColumn => generatedImages.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Image produite par édition conditionnée (Nano Banana) à partir d'une ou plusieurs BrandAsset.
// Un seul mode existe en v1 : "staging" (mise en scène — fond/lumière/cadrage autour du produit réel).
// Le mode "transformation du produit" (couleur/matière/forme) n'existe pas dans le code, cf.
// docs/SPEC_RESSOURCES_VISUELLES.md §6.1 — ce n'est pas une option masquée, c'est une absence.
export const generatedImages = pgTable("generated_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").references((): AnyPgColumn => scripts.id, { onDelete: "set null" }),
  sourceAssetIds: uuid("source_asset_ids").array().notNull(), // pas de FK sur array Postgres
  mode: text("mode").notNull().default("staging"),
  instruction: text("instruction"),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  width: integer("width"),
  height: integer("height"),
  status: generatedImageStatusEnum("status").notNull().default("ready"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Vue courante des métriques d'un post (1:1 avec Script). L'historique daté vit dans
// postMetricsSnapshots ci-dessous — cette table reste la valeur "actuelle" utilisée partout
// ailleurs dans le code (buildPerformanceSummary, categoryReweightService, etc.).
export const postMetrics = pgTable("post_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  scriptId: uuid("script_id").notNull().unique().references(() => scripts.id, { onDelete: "cascade" }),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  // "manual" = saisie via PUT /api/scripts/:id/metrics, "api" = récupéré automatiquement et
  // rattaché (confirmé) via le flow de matching post↔script (docs/SPEC_METRIQUES_AUTO.md §4).
  // La re-pondération automatique des catégories ne considère jamais source="manual" — non vérifié.
  source: postMetricsSourceEnum("source").notNull().default("manual"),
  platformPostId: text("platform_post_id"),
  fetchedAt: timestamp("fetched_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Historique daté, jamais écrasé — résout l'absence d'historique de PostMetrics identifiée en
// docs/SPEC_METRIQUES_AUTO.md §5 (un post à J+7 et à J+30 sont deux informations différentes).
export const postMetricsSnapshots = pgTable("post_metrics_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  source: postMetricsSourceEnum("source").notNull(),
  capturedAt: timestamp("captured_at").notNull().defaultNow(),
});

// Candidats de rattachement post↔script en attente de confirmation utilisateur
// (docs/SPEC_METRIQUES_AUTO.md §4, piste heuristique + confirmation unique). Un candidat
// "confirmed" ou "dismissed" n'est plus jamais reproposé pour ce (platform, platformPostId).
export const postMatchCandidates = pgTable(
  "post_match_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    platformPostId: text("platform_post_id").notNull(),
    externalUrl: text("external_url").notNull(),
    captionText: text("caption_text"),
    publishedAt: timestamp("published_at"),
    score: real("score").notNull(),
    // Métriques du post au moment du scan — évite un second appel API à la confirmation.
    metrics: jsonb("metrics").notNull(),
    status: postMatchCandidateStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [unique().on(t.platform, t.platformPostId)]
);

// Un événement par génération OU régénération de script — distinct de `scripts.createdAt`, qui ne
// bouge jamais sur une régénération (updateScriptRecord fait un UPDATE en place sur la même ligne).
// C'est cette table, pas `scripts`, que billingService.ts compte pour le quota mensuel : le coût
// LLM (donc le quota) est déclenché à chaque génération, régénération comprise.
export const scriptGenerationEvents = pgTable("script_generation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").notNull().references(() => scripts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Facturation self-service (Stripe). Une seule ligne par utilisateur — un utilisateur qui n'a
// jamais payé n'a pas de ligne du tout (essai gratuit géré par comptage dans billingService.ts,
// pas par une ligne "free" ici). stripeSubscriptionId reste null tant que checkout.session.completed
// n'est pas arrivé ; currentPeriodStart/End reflètent la période Stripe en cours, utilisée pour
// borner le comptage des scripts générés dans le quota du mois.
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  plan: subscriptionPlanEnum("plan").notNull(),
  status: subscriptionStatusEnum("status").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Rate limiting fenêtre fixe, backé Postgres (pas de Redis dans l'infra actuelle — cf.
// docs/TECH.md §7 sécurité). `key` = `${scope}:${identifier}:${windowStart epoch}`, ex.
// "login:203.0.113.4:1799990400". Une ligne = un compteur pour une fenêtre passée ; les fenêtres
// expirées sont supprimées paresseusement à chaque appel de checkRateLimit (pas de cron dans ce
// repo, même philosophie que le reste de l'app).
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start").notNull(),
});

export const postingGoals = pgTable("posting_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  targetCountPerWeek: real("target_count_per_week").notNull(),
});

export const calendarEntries = pgTable("calendar_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").references(() => scripts.id, { onDelete: "set null" }),
  platform: text("platform").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  contentCategoryId: uuid("content_category_id").notNull().references(() => contentCategories.id),
  seriesId: uuid("series_id").references(() => contentSeries.id, { onDelete: "set null" }),
  status: calendarStatusEnum("status").notNull().default("planned"),
  reminderSent: boolean("reminder_sent").notNull().default(false),
});

export const productsRelations = relations(products, ({ many }) => ({
  scripts: many(scripts),
  brandAssets: many(brandAssets),
}));

export const brandAssetsRelations = relations(brandAssets, ({ one }) => ({
  product: one(products, { fields: [brandAssets.productId], references: [products.id] }),
}));

export const generatedImagesRelations = relations(generatedImages, ({ one }) => ({
  script: one(scripts, { fields: [generatedImages.scriptId], references: [scripts.id] }),
}));

export const contentCategoriesRelations = relations(contentCategories, ({ many }) => ({
  scripts: many(scripts),
  calendarEntries: many(calendarEntries),
  contentSeriesCategories: many(contentSeriesCategories),
  contentCategoriesPlatforms: many(contentCategoriesPlatforms),
}));

export const contentAnglesRelations = relations(contentAngles, ({ many }) => ({
  scripts: many(scripts),
}));

export const contentSeriesRelations = relations(contentSeries, ({ many }) => ({
  scripts: many(scripts),
  calendarEntries: many(calendarEntries),
  contentSeriesCategories: many(contentSeriesCategories),
  contentSeriesPlatforms: many(contentSeriesPlatforms),
}));

export const contentSeriesCategoriesRelations = relations(contentSeriesCategories, ({ one }) => ({
  series: one(contentSeries, { fields: [contentSeriesCategories.seriesId], references: [contentSeries.id] }),
  category: one(contentCategories, { fields: [contentSeriesCategories.categoryId], references: [contentCategories.id] }),
}));

export const contentCategoriesPlatformsRelations = relations(contentCategoriesPlatforms, ({ one }) => ({
  category: one(contentCategories, {
    fields: [contentCategoriesPlatforms.categoryId],
    references: [contentCategories.id],
  }),
}));

export const contentSeriesPlatformsRelations = relations(contentSeriesPlatforms, ({ one }) => ({
  series: one(contentSeries, { fields: [contentSeriesPlatforms.seriesId], references: [contentSeries.id] }),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  product: one(products, { fields: [scripts.productId], references: [products.id] }),
  contentCategory: one(contentCategories, {
    fields: [scripts.contentCategoryId],
    references: [contentCategories.id],
  }),
  angle: one(contentAngles, { fields: [scripts.angleId], references: [contentAngles.id] }),
  series: one(contentSeries, { fields: [scripts.seriesId], references: [contentSeries.id] }),
  brandAsset: one(brandAssets, { fields: [scripts.brandAssetId], references: [brandAssets.id] }),
  generatedImage: one(generatedImages, { fields: [scripts.generatedImageId], references: [generatedImages.id] }),
  calendarEntries: many(calendarEntries),
  metrics: one(postMetrics, { fields: [scripts.id], references: [postMetrics.scriptId] }),
  metricsSnapshots: many(postMetricsSnapshots),
  matchCandidates: many(postMatchCandidates),
}));

export const postMetricsRelations = relations(postMetrics, ({ one }) => ({
  script: one(scripts, { fields: [postMetrics.scriptId], references: [scripts.id] }),
}));

export const postMetricsSnapshotsRelations = relations(postMetricsSnapshots, ({ one }) => ({
  script: one(scripts, { fields: [postMetricsSnapshots.scriptId], references: [scripts.id] }),
}));

export const postMatchCandidatesRelations = relations(postMatchCandidates, ({ one }) => ({
  script: one(scripts, { fields: [postMatchCandidates.scriptId], references: [scripts.id] }),
}));

export const calendarEntriesRelations = relations(calendarEntries, ({ one }) => ({
  script: one(scripts, { fields: [calendarEntries.scriptId], references: [scripts.id] }),
  contentCategory: one(contentCategories, {
    fields: [calendarEntries.contentCategoryId],
    references: [contentCategories.id],
  }),
  series: one(contentSeries, { fields: [calendarEntries.seriesId], references: [contentSeries.id] }),
}));

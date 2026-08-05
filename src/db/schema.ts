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
]);
export const assistantProposalStatusEnum = pgEnum("assistant_proposal_status", ["pending", "accepted", "rejected"]);

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

export const socialConnections = pgTable("social_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postMetrics = pgTable("post_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  scriptId: uuid("script_id").notNull().unique().references(() => scripts.id, { onDelete: "cascade" }),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  calendarEntries: many(calendarEntries),
  metrics: one(postMetrics, { fields: [scripts.id], references: [postMetrics.scriptId] }),
}));

export const postMetricsRelations = relations(postMetrics, ({ one }) => ({
  script: one(scripts, { fields: [postMetrics.scriptId], references: [scripts.id] }),
}));

export const calendarEntriesRelations = relations(calendarEntries, ({ one }) => ({
  script: one(scripts, { fields: [calendarEntries.scriptId], references: [scripts.id] }),
  contentCategory: one(contentCategories, {
    fields: [calendarEntries.contentCategoryId],
    references: [contentCategories.id],
  }),
  series: one(contentSeries, { fields: [calendarEntries.seriesId], references: [contentSeries.id] }),
}));

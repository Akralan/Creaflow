import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const platformEnum = pgEnum("platform", ["tiktok", "instagram", "linkedin"]);
export const contentCategoryEnum = pgEnum("content_category", ["vente", "coulisses", "educatif"]);
export const scriptStatusEnum = pgEnum("script_status", ["draft", "planned", "shot", "published"]);
export const calendarStatusEnum = pgEnum("calendar_status", ["planned", "shot", "published"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  categoryLabels: jsonb("category_labels"),
});

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
  platform: platformEnum("platform").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  platformUserId: text("platform_user_id").notNull(),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});

export const inspirationVideos = pgTable("inspiration_videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  externalUrl: text("external_url").notNull(),
  captionText: text("caption_text"),
  metadata: jsonb("metadata"),
  fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
});

export const scripts = pgTable("scripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  platform: platformEnum("platform").notNull(),
  title: text("title").notNull(),
  hookVisual: text("hook_visual"),
  hookText: text("hook_text"),
  hookAudio: text("hook_audio"),
  storyboard: jsonb("storyboard"),
  caption: text("caption"),
  hashtags: text("hashtags").array(),
  soundRecommendation: text("sound_recommendation"),
  contentCategory: contentCategoryEnum("content_category").notNull(),
  status: scriptStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postingGoals = pgTable("posting_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: platformEnum("platform").notNull(),
  targetCountPerWeek: integer("target_count_per_week").notNull(),
});

export const calendarEntries = pgTable("calendar_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scriptId: uuid("script_id").references(() => scripts.id, { onDelete: "set null" }),
  platform: platformEnum("platform").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  contentCategory: contentCategoryEnum("content_category").notNull(),
  status: calendarStatusEnum("status").notNull().default("planned"),
  reminderSent: boolean("reminder_sent").notNull().default(false),
});

export const productsRelations = relations(products, ({ many }) => ({
  scripts: many(scripts),
}));

export const scriptsRelations = relations(scripts, ({ one, many }) => ({
  product: one(products, { fields: [scripts.productId], references: [products.id] }),
  calendarEntries: many(calendarEntries),
}));

export const calendarEntriesRelations = relations(calendarEntries, ({ one }) => ({
  script: one(scripts, { fields: [calendarEntries.scriptId], references: [scripts.id] }),
}));

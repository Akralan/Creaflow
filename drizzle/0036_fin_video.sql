-- Fin de la vidéo (docs/SPEC_ONBOARDING_MVP.md §6). Données d'abord, écrites à la main : les scripts
-- vidéo et tout ce qui vit sur TikTok/YouTube disparaissent. Les tables filles des scripts sont en
-- CASCADE, calendar_entries.script_id en SET NULL (le créneau redevient vide).
DELETE FROM "scripts" WHERE "content_type" = 'video' OR "platform" IN ('tiktok', 'youtube');--> statement-breakpoint
DELETE FROM "calendar_entries" WHERE "platform" IN ('tiktok', 'youtube');--> statement-breakpoint
DELETE FROM "posting_goals" WHERE "platform" IN ('tiktok', 'youtube');--> statement-breakpoint
DELETE FROM "content_series_platforms" WHERE "platform" IN ('tiktok', 'youtube');--> statement-breakpoint
DELETE FROM "content_categories_platforms" WHERE "platform" IN ('tiktok', 'youtube');--> statement-breakpoint
DELETE FROM "social_connections" WHERE "platform" IN ('tiktok', 'youtube');--> statement-breakpoint
DELETE FROM "inspiration_videos" WHERE "platform" IN ('tiktok', 'youtube');--> statement-breakpoint
DELETE FROM "post_match_candidates" WHERE "platform" IN ('tiktok', 'youtube');--> statement-breakpoint
ALTER TABLE "scripts" ALTER COLUMN "content_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "scripts" ALTER COLUMN "content_type" SET DEFAULT 'text'::text;--> statement-breakpoint
DROP TYPE "public"."content_type";--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('visual', 'text');--> statement-breakpoint
ALTER TABLE "scripts" ALTER COLUMN "content_type" SET DEFAULT 'text'::"public"."content_type";--> statement-breakpoint
ALTER TABLE "scripts" ALTER COLUMN "content_type" SET DATA TYPE "public"."content_type" USING "content_type"::"public"."content_type";--> statement-breakpoint
ALTER TABLE "scripts" DROP COLUMN "hook_audio";--> statement-breakpoint
ALTER TABLE "scripts" DROP COLUMN "sound_recommendation";
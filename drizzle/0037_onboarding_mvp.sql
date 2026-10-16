-- Onboarding MVP (docs/SPEC_ONBOARDING_MVP.md §3). Fusion à la main de deux générations : drizzle-kit
-- demande en interactif si `expectations` renomme `tone`, ce qui n'est pas le cas.
ALTER TYPE "public"."assistant_proposal_kind" ADD VALUE 'publishing_days_update' BEFORE 'profile_update';--> statement-breakpoint
DROP TABLE "onboarding_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "creator_profiles" DROP COLUMN "tone";--> statement-breakpoint
ALTER TABLE "creator_profiles" DROP COLUMN "values";--> statement-breakpoint
ALTER TABLE "creator_profiles" DROP COLUMN "equipment";--> statement-breakpoint
ALTER TABLE "creator_profiles" DROP COLUMN "weekly_time_available";--> statement-breakpoint
DROP TYPE "public"."onboarding_status";--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD COLUMN "expectations" text;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD COLUMN "publishing_days" integer[] DEFAULT '{3,6}' NOT NULL;

ALTER TYPE "public"."onboarding_track" RENAME TO "vertical";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "onboarding_track" TO "vertical";
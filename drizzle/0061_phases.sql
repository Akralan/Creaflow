CREATE TYPE "public"."project_phase" AS ENUM('engage', 'build', 'beta', 'launch', 'grow');--> statement-breakpoint
ALTER TYPE "public"."post_form" ADD VALUE 'demo';--> statement-breakpoint
ALTER TYPE "public"."post_form" ADD VALUE 'beta_call';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "phase" "project_phase" DEFAULT 'build' NOT NULL;
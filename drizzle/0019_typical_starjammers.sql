ALTER TYPE "public"."assistant_proposal_kind" ADD VALUE 'profile_update' BEFORE 'category_reweight';--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD COLUMN "target_audience" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "target_audience" text;
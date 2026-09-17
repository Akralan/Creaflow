ALTER TYPE "public"."assistant_proposal_kind" ADD VALUE 'style_profile_update' BEFORE 'category_reweight';--> statement-breakpoint
ALTER TABLE "scripts" ADD COLUMN "style_learned_at" timestamp;